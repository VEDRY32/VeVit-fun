/**
 * Cihlobijec — pádlo, míček a cihly.
 *
 * Kolize řeší swept test (spojitá detekce), ne kontrola překryvu po kroku:
 * míček se při vyšších rychlostech posouvá o víc než je tloušťka cihly,
 * takže by jinak tunelem prolétl skrz.
 */

import { createRng, type Rng } from '@vevit-games/engine/core';

export const CIHLOBIJEC_RULES_VERSION = 1;

export const FIELD_W = 480;
export const FIELD_H = 620;
export const BRICK_COLS = 10;
export const BRICK_ROWS = 8;
export const BRICK_W = FIELD_W / BRICK_COLS;
export const BRICK_H = 22;
export const BRICK_TOP = 60;

export const PADDLE_Y = FIELD_H - 40;
export const PADDLE_H = 12;
const PADDLE_BASE_W = 88;
const BALL_RADIUS = 6;
const BALL_SPEED_START = 4.6;
const BALL_SPEED_MAX = 9.5;
/** Nejostřejší úhel odrazu od pádla — kolmý odraz by hru zasekl. */
const MAX_BOUNCE_ANGLE = (Math.PI / 180) * 62;

export type PowerupKind =
  | 'siroke-padlo' | 'vic-micku' | 'laser' | 'lepidlo' | 'zpomaleni' | 'prurazny';

export interface Brick {
  col: number;
  row: number;
  /** Zbývající vrstvy; 0 = rozbitá. */
  hits: number;
  /** Nerozbitná cihla, která se počítá jako překážka, ne jako cíl. */
  solid: boolean;
  powerup: PowerupKind | null;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Přilepený na pádle, dokud ho hráč nevystřelí. */
  stuck: boolean;
  /** Prorazí cihlu a letí dál. */
  piercing: boolean;
}

export interface FallingPowerup {
  x: number;
  y: number;
  kind: PowerupKind;
}

export interface CihlobijecState {
  bricks: Brick[];
  balls: Ball[];
  powerups: FallingPowerup[];
  paddleX: number;
  paddleW: number;
  lives: number;
  score: number;
  level: number;
  tick: number;
  /** Odpočty aktivních vylepšení v krocích logiky. */
  effects: Partial<Record<PowerupKind, number>>;
  lasers: { x: number; y: number }[];
  laserCooldown: number;
  over: boolean;
  won: boolean;
}

export interface CihlobijecGame {
  readonly state: CihlobijecState;
  readonly rulesVersion: number;
  /** Jeden krok logiky. `paddleTarget` je požadovaná pozice středu pádla. */
  step(paddleTarget: number, release: boolean, fire: boolean): void;
  /** Cihly, které ještě zbývá rozbít. */
  remaining(): number;
  loadLevel(level: number): void;
}

/**
 * Rozvržení úrovní jako textová mapa.
 * `.` prázdno, `1`–`3` počet vrstev, `#` nerozbitná, `P` cihla s vylepšením.
 */
const LEVELS: string[][] = [
  [
    '..........',
    '.111111111',
    '.1P1111P11',
    '.111111111',
    '..........',
  ],
  [
    '1111111111',
    '1222222221',
    '12P3333P21',
    '1222222221',
    '1111111111',
  ],
  [
    '..1....1..',
    '.121..121.',
    '12#2112#21',
    '.1P21121P1',
    '..1....1..',
    '1111111111',
  ],
];

const POWERUP_POOL: PowerupKind[] = [
  'siroke-padlo', 'vic-micku', 'laser', 'lepidlo', 'zpomaleni', 'prurazny',
];

const EFFECT_TICKS = 12 * 60;

export function createCihlobijec(seed: string, startLevel = 0): CihlobijecGame {
  const rng: Rng = createRng(seed);

  const state: CihlobijecState = {
    bricks: [],
    balls: [],
    powerups: [],
    paddleX: FIELD_W / 2,
    paddleW: PADDLE_BASE_W,
    lives: 3,
    score: 0,
    level: startLevel,
    tick: 0,
    effects: {},
    lasers: [],
    laserCooldown: 0,
    over: false,
    won: false,
  };

  const resetBall = (): void => {
    state.balls = [{
      x: state.paddleX,
      y: PADDLE_Y - BALL_RADIUS - 2,
      vx: 0,
      vy: 0,
      stuck: true,
      piercing: false,
    }];
  };

  const loadLevel = (level: number): void => {
    const map = LEVELS[level % LEVELS.length]!;
    state.bricks = [];
    for (let row = 0; row < map.length; row++) {
      const line = map[row]!;
      for (let col = 0; col < BRICK_COLS; col++) {
        const char = line[col] ?? '.';
        if (char === '.') continue;
        state.bricks.push({
          col, row,
          hits: char === '#' ? Number.POSITIVE_INFINITY : char === 'P' ? 1 : Number(char),
          solid: char === '#',
          powerup: char === 'P' ? rng.pick(POWERUP_POOL) : null,
        });
      }
    }
    state.level = level;
    state.paddleX = FIELD_W / 2;
    state.paddleW = PADDLE_BASE_W;
    state.effects = {};
    state.powerups = [];
    state.lasers = [];
    resetBall();
  };

  loadLevel(startLevel);

  const brickRect = (brick: Brick): { x: number; y: number; w: number; h: number } => ({
    x: brick.col * BRICK_W,
    y: BRICK_TOP + brick.row * BRICK_H,
    w: BRICK_W,
    h: BRICK_H,
  });

  /**
   * Spojitá kolize kruhu s obdélníkem: vrací podíl kroku, ve kterém
   * k nárazu došlo, a osu odrazu. `null`, když k nárazu nedošlo.
   */
  function sweepBall(
    ball: Ball,
    rect: { x: number; y: number; w: number; h: number },
  ): { t: number; axis: 'x' | 'y' } | null {
    // Rozšíříme obdélník o poloměr míčku a řešíme paprsek vs. obdélník.
    const left = rect.x - BALL_RADIUS;
    const right = rect.x + rect.w + BALL_RADIUS;
    const top = rect.y - BALL_RADIUS;
    const bottom = rect.y + rect.h + BALL_RADIUS;

    // Míček, který krok začíná uvnitř tělesa, je zvláštní případ: paprsek
    // by dal t = 0 a osa odrazu by vyšla podle pořadí v cyklu, ne podle
    // geometrie. Řešíme ho vytlačením po ose s nejmenším průnikem — jinak
    // by se míček uvnitř cihly zasekl.
    const insideX = ball.x > left && ball.x < right;
    const insideY = ball.y > top && ball.y < bottom;
    if (insideX && insideY) {
      const penetrationX = Math.min(ball.x - left, right - ball.x);
      const penetrationY = Math.min(ball.y - top, bottom - ball.y);
      return { t: 0, axis: penetrationX < penetrationY ? 'x' : 'y' };
    }

    let tMin = 0;
    let tMax = 1;
    let axis: 'x' | 'y' = 'x';

    for (const [pos, velocity, lo, hi, name] of [
      [ball.x, ball.vx, left, right, 'x'],
      [ball.y, ball.vy, top, bottom, 'y'],
    ] as const) {
      if (Math.abs(velocity) < 1e-9) {
        if (pos < lo || pos > hi) return null;
        continue;
      }
      let t1 = (lo - pos) / velocity;
      let t2 = (hi - pos) / velocity;
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tMin) {
        tMin = t1;
        axis = name;
      }
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return null;
    }

    if (tMin < 0 || tMin > 1) return null;
    return { t: tMin, axis };
  }

  const speedOf = (ball: Ball): number => Math.hypot(ball.vx, ball.vy);

  const hitBrick = (brick: Brick): void => {
    if (brick.solid) return;
    brick.hits--;
    state.score += 10;
    if (brick.hits > 0) return;

    state.score += 40;
    if (brick.powerup) {
      const rect = brickRect(brick);
      state.powerups.push({
        x: rect.x + rect.w / 2,
        y: rect.y + rect.h / 2,
        kind: brick.powerup,
      });
    }
  };

  const applyPowerup = (kind: PowerupKind): void => {
    state.effects[kind] = EFFECT_TICKS;
    switch (kind) {
      case 'siroke-padlo':
        state.paddleW = PADDLE_BASE_W * 1.6;
        break;
      case 'vic-micku': {
        // Dva nové míčky vyletí z pozice prvního pod různými úhly.
        const source = state.balls[0];
        if (!source || state.balls.length >= 6) break;
        for (const angle of [-0.5, 0.5]) {
          const speed = Math.max(BALL_SPEED_START, speedOf(source));
          const base = Math.atan2(source.vy, source.vx) + angle;
          state.balls.push({
            x: source.x, y: source.y,
            vx: Math.cos(base) * speed,
            vy: Math.sin(base) * speed,
            stuck: false,
            piercing: source.piercing,
          });
        }
        break;
      }
      case 'zpomaleni':
        for (const ball of state.balls) {
          ball.vx *= 0.72;
          ball.vy *= 0.72;
        }
        break;
      case 'prurazny':
        for (const ball of state.balls) ball.piercing = true;
        break;
      default:
        break;
    }
  };

  const loseBall = (): void => {
    state.lives--;
    if (state.lives <= 0) {
      state.over = true;
      return;
    }
    state.paddleW = PADDLE_BASE_W;
    state.effects = {};
    resetBall();
  };

  return {
    state,
    rulesVersion: CIHLOBIJEC_RULES_VERSION,
    loadLevel,

    remaining: () => state.bricks.filter((b) => !b.solid && b.hits > 0).length,

    step(paddleTarget, release, fire) {
      if (state.over || state.won) return;
      state.tick++;

      // Pádlo dojíždí k cíli, aby myš i klávesnice působily stejně.
      const halfWidth = state.paddleW / 2;
      const clamped = Math.max(halfWidth, Math.min(FIELD_W - halfWidth, paddleTarget));
      state.paddleX += (clamped - state.paddleX) * 0.45;

      for (const [kind, ticks] of Object.entries(state.effects)) {
        if (ticks == null) continue;
        const left = ticks - 1;
        if (left <= 0) {
          delete state.effects[kind as PowerupKind];
          if (kind === 'siroke-padlo') state.paddleW = PADDLE_BASE_W;
          if (kind === 'prurazny') for (const ball of state.balls) ball.piercing = false;
        } else {
          state.effects[kind as PowerupKind] = left;
        }
      }

      // Laser
      if (state.laserCooldown > 0) state.laserCooldown--;
      if (fire && state.effects.laser && state.laserCooldown === 0) {
        state.lasers.push({ x: state.paddleX, y: PADDLE_Y });
        state.laserCooldown = 18;
      }
      for (const laser of state.lasers) laser.y -= 11;
      state.lasers = state.lasers.filter((laser) => {
        if (laser.y < 0) return false;
        for (const brick of state.bricks) {
          if (brick.hits <= 0) continue;
          const rect = brickRect(brick);
          if (laser.x >= rect.x && laser.x <= rect.x + rect.w
            && laser.y >= rect.y && laser.y <= rect.y + rect.h) {
            hitBrick(brick);
            return false;
          }
        }
        return true;
      });

      for (const ball of state.balls) {
        if (ball.stuck) {
          ball.x = state.paddleX;
          ball.y = PADDLE_Y - BALL_RADIUS - 2;
          if (release) {
            ball.stuck = false;
            ball.vx = BALL_SPEED_START * 0.4;
            ball.vy = -BALL_SPEED_START;
          }
          continue;
        }

        // Krok se dělí na dílčí úseky podle nejbližší kolize.
        let remainingStep = 1;
        let guard = 0;
        while (remainingStep > 0 && guard++ < 8) {
          let nearest: { t: number; axis: 'x' | 'y'; brick: Brick | null } | null = null;

          for (const brick of state.bricks) {
            if (brick.hits <= 0) continue;
            const hit = sweepBall(
              { ...ball, vx: ball.vx * remainingStep, vy: ball.vy * remainingStep },
              brickRect(brick),
            );
            if (hit && (!nearest || hit.t < nearest.t)) {
              nearest = { t: hit.t, axis: hit.axis, brick };
            }
          }

          // Pádlo — jen když míček letí dolů.
          if (ball.vy > 0) {
            const paddleRect = {
              x: state.paddleX - state.paddleW / 2,
              y: PADDLE_Y,
              w: state.paddleW,
              h: PADDLE_H,
            };
            const hit = sweepBall(
              { ...ball, vx: ball.vx * remainingStep, vy: ball.vy * remainingStep },
              paddleRect,
            );
            if (hit && (!nearest || hit.t < nearest.t)) {
              nearest = { t: hit.t, axis: hit.axis, brick: null };
            }
          }

          if (!nearest) {
            ball.x += ball.vx * remainingStep;
            ball.y += ball.vy * remainingStep;
            break;
          }

          // Posun k místu nárazu.
          const travel = remainingStep * nearest.t;
          ball.x += ball.vx * travel;
          ball.y += ball.vy * travel;
          remainingStep -= travel;

          if (nearest.brick) {
            hitBrick(nearest.brick);
            if (!ball.piercing || nearest.brick.solid) {
              if (nearest.axis === 'x') ball.vx = -ball.vx;
              else ball.vy = -ball.vy;
            }
          } else {
            // Úhel odrazu podle místa dopadu na pádlo.
            const offset = (ball.x - state.paddleX) / (state.paddleW / 2);
            const angle = Math.max(-1, Math.min(1, offset)) * MAX_BOUNCE_ANGLE;
            const speed = Math.min(BALL_SPEED_MAX, speedOf(ball) * 1.02);
            ball.vx = Math.sin(angle) * speed;
            ball.vy = -Math.cos(angle) * speed;
            if (state.effects.lepidlo) {
              ball.stuck = true;
              remainingStep = 0;
            }
          }

          // Odsunutí o vlásek, aby další swept test nezačal uvnitř tělesa.
          ball.x += ball.vx * 0.001;
          ball.y += ball.vy * 0.001;
        }

        // Stěny
        if (ball.x - BALL_RADIUS < 0) {
          ball.x = BALL_RADIUS;
          ball.vx = Math.abs(ball.vx);
        } else if (ball.x + BALL_RADIUS > FIELD_W) {
          ball.x = FIELD_W - BALL_RADIUS;
          ball.vx = -Math.abs(ball.vx);
        }
        if (ball.y - BALL_RADIUS < 0) {
          ball.y = BALL_RADIUS;
          ball.vy = Math.abs(ball.vy);
        }
      }

      state.bricks = state.bricks.filter((brick) => brick.solid || brick.hits > 0);

      // Míčky pod spodní hranou.
      const alive = state.balls.filter((ball) => ball.y - BALL_RADIUS < FIELD_H);
      if (alive.length === 0) loseBall();
      else state.balls = alive;

      // Padající vylepšení.
      for (const powerup of state.powerups) powerup.y += 2.6;
      state.powerups = state.powerups.filter((powerup) => {
        if (powerup.y > FIELD_H) return false;
        const caught = powerup.y >= PADDLE_Y - 8
          && Math.abs(powerup.x - state.paddleX) <= state.paddleW / 2 + 8;
        if (caught) {
          applyPowerup(powerup.kind);
          state.score += 50;
          return false;
        }
        return true;
      });

      if (state.bricks.filter((b) => !b.solid && b.hits > 0).length === 0) {
        if (state.level + 1 >= LEVELS.length) state.won = true;
        else {
          state.score += 500;
          loadLevel(state.level + 1);
        }
      }
    },
  };
}

export const CIHLOBIJEC_LEVEL_COUNT = LEVELS.length;
export { BALL_RADIUS };
