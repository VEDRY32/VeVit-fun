/**
 * Průchody — hlavolam s hybností.
 *
 * Hráč umisťuje dvojici průchodů na stěny. Kulička padá, a když vletí do
 * jednoho průchodu, vyletí z druhého — se stejnou rychlostí, jen otočenou
 * po směru druhého ústí. O to celé jde: zrychlit pádem a hybnost si
 * odnést jinam.
 *
 * Všechno je čistě aritmetické a bez náhody, takže je běh přehratelný.
 */

import { LEVELS, type LevelSpec } from './levels.js';

export const PRUCHODY_RULES_VERSION = 1;

export const TILE = 32;
export const BALL_R = 8;

const GRAVITY = 0.32;
const MAX_SPEED = 13;
/** Odraz od stěny bez průchodu; kulička se o ni „olízne". */
const BOUNCE = 0.42;
const FRICTION = 0.995;
/** Jak daleko od ústí kulička vyletí, aby se hned nevrátila. */
const EXIT_OFFSET = BALL_R + 3;

export type Side = 'up' | 'down' | 'left' | 'right';

export interface Portal {
  tx: number;
  ty: number;
  side: Side;
}

export interface PruchodyState {
  level: number;
  width: number;
  height: number;
  rows: string[];
  ball: { x: number; y: number; vx: number; vy: number };
  /** Kulička čeká na puštění; do té doby na ni gravitace nepůsobí. */
  released: boolean;
  portals: [Portal | null, Portal | null];
  goal: { x: number; y: number };
  start: { x: number; y: number };
  attempts: number;
  ticks: number;
  score: number;
  levelDone: boolean;
  won: boolean;
}

export interface PruchodyGame {
  readonly state: PruchodyState;
  readonly rulesVersion: number;
  readonly levels: LevelSpec[];
  step(): void;
  /** Položí průchod (0 nebo 1) na stěnu pod zadaným bodem. */
  place(index: 0 | 1, x: number, y: number): boolean;
  /** Pustí kuličku; opakované volání ji vrátí na start. */
  release(): void;
  reset(): void;
  loadLevel(index: number): void;
  charAt(tx: number, ty: number): string;
}

const NORMAL: Record<Side, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function createPruchody(seed: string, startLevel = 0): PruchodyGame {
  void seed; // hra nemá náhodu

  const state: PruchodyState = {
    level: 0,
    width: 0,
    height: 0,
    rows: [],
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    released: false,
    portals: [null, null],
    goal: { x: 0, y: 0 },
    start: { x: 0, y: 0 },
    attempts: 0,
    ticks: 0,
    score: 0,
    levelDone: false,
    won: false,
  };

  const charAt = (tx: number, ty: number): string => {
    if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return '#';
    return state.rows[ty]![tx] ?? '.';
  };

  const isWall = (tx: number, ty: number): boolean => {
    const char = charAt(tx, ty);
    return char === '#' || char === 'x';
  };

  /** Kov průchod neunese — to je hlavní omezení hlavolamu. */
  const takesPortal = (tx: number, ty: number): boolean => charAt(tx, ty) === '#';

  const loadLevel = (index: number): void => {
    const spec = LEVELS[index];
    if (!spec) return;
    state.level = index;
    state.rows = [...spec.rows];
    state.width = spec.rows[0]?.length ?? 0;
    state.height = spec.rows.length;
    state.portals = [null, null];
    state.levelDone = false;
    state.attempts = 0;
    state.ticks = 0;

    spec.rows.forEach((row, ty) => {
      [...row].forEach((char, tx) => {
        if (char === 'B') state.start = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
        else if (char === 'C') state.goal = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
      });
    });
    reset();
  };

  function reset(): void {
    state.ball = { x: state.start.x, y: state.start.y, vx: 0, vy: 0 };
    state.released = false;
  }

  const release = (): void => {
    if (state.released) {
      reset();
      return;
    }
    state.released = true;
    state.attempts++;
  };

  /**
   * Na kterou stranu dlaždice hráč klikl. Bere se ta, ke které je bod
   * nejblíž — díky tomu se průchod dá položit i lehce mimo hranu.
   */
  const sideFor = (tx: number, ty: number, x: number, y: number): Side => {
    const localX = x - tx * TILE;
    const localY = y - ty * TILE;
    const distances: [Side, number][] = [
      ['left', localX],
      ['right', TILE - localX],
      ['up', localY],
      ['down', TILE - localY],
    ];
    distances.sort((a, b) => a[1] - b[1]);
    return distances[0]![0];
  };

  const place = (index: 0 | 1, x: number, y: number): boolean => {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (!takesPortal(tx, ty)) return false;

    const side = sideFor(tx, ty, x, y);
    // Ústí musí mířit do volného prostoru, jinak by se z něj nedalo vyletět.
    const normal = NORMAL[side];
    if (isWall(tx + normal.x, ty + normal.y)) return false;

    const other = state.portals[index === 0 ? 1 : 0];
    if (other && other.tx === tx && other.ty === ty && other.side === side) return false;

    state.portals[index] = { tx, ty, side };
    return true;
  };

  /** Střed ústí průchodu v pixelech. */
  const portalMouth = (portal: Portal): { x: number; y: number } => {
    const normal = NORMAL[portal.side];
    return {
      x: portal.tx * TILE + TILE / 2 + normal.x * (TILE / 2),
      y: portal.ty * TILE + TILE / 2 + normal.y * (TILE / 2),
    };
  };

  /** Vletěla kulička do ústí? Musí být blízko a letět dovnitř. */
  const entersPortal = (portal: Portal): boolean => {
    const mouth = portalMouth(portal);
    const normal = NORMAL[portal.side];
    const dx = state.ball.x - mouth.x;
    const dy = state.ball.y - mouth.y;
    // Vzdálenost podél normály a napříč ní.
    const along = dx * normal.x + dy * normal.y;
    const across = Math.abs(dx * normal.y - dy * normal.x);
    if (across > TILE / 2) return false;
    if (along > BALL_R + 2 || along < -BALL_R) return false;
    const into = state.ball.vx * normal.x + state.ball.vy * normal.y;
    return into < 0;
  };

  const teleport = (from: 0 | 1): void => {
    const target = state.portals[from === 0 ? 1 : 0];
    if (!target) return;

    const speed = Math.hypot(state.ball.vx, state.ball.vy);
    const normal = NORMAL[target.side];
    const mouth = portalMouth(target);
    state.ball.x = mouth.x + normal.x * EXIT_OFFSET;
    state.ball.y = mouth.y + normal.y * EXIT_OFFSET;
    // Hybnost zůstává, mění se jen směr — to je celá pointa hry.
    state.ball.vx = normal.x * speed;
    state.ball.vy = normal.y * speed;
  };

  /**
   * Posun o jeden dílek. Průchod se kontroluje tady, ne jednou za krok:
   * kulička se stěny dotkne uvnitř dílku a bez téhle kontroly by se od ní
   * odrazila dřív, než by ji ústí stihlo pohltit.
   *
   * Vrací `true`, když se kulička přenesla — pak se zbytek kroku zahodí.
   */
  const substep = (dx: number, dy: number): boolean => {
    const ball = state.ball;

    for (const index of [0, 1] as const) {
      const portal = state.portals[index];
      if (portal && entersPortal(portal)) {
        teleport(index);
        return true;
      }
    }

    const nextX = ball.x + dx;
    if (isWall(Math.floor((nextX + Math.sign(dx) * BALL_R) / TILE), Math.floor(ball.y / TILE))) {
      ball.vx = -ball.vx * BOUNCE;
    } else {
      ball.x = nextX;
    }

    const nextY = ball.y + dy;
    if (isWall(Math.floor(ball.x / TILE), Math.floor((nextY + Math.sign(dy) * BALL_R) / TILE))) {
      ball.vy = -ball.vy * BOUNCE;
      ball.vx *= 0.94;
    } else {
      ball.y = nextY;
    }
    return false;
  };

  loadLevel(startLevel);

  return {
    state,
    rulesVersion: PRUCHODY_RULES_VERSION,
    levels: LEVELS,
    place,
    release,
    reset,
    loadLevel,
    charAt,

    step() {
      if (state.won) return;
      state.ticks++;

      if (state.levelDone) {
        if (state.ticks % 90 === 0) {
          if (state.level + 1 >= LEVELS.length) state.won = true;
          else loadLevel(state.level + 1);
        }
        return;
      }

      if (!state.released) return;

      const ball = state.ball;
      ball.vy = Math.min(MAX_SPEED, ball.vy + GRAVITY);
      ball.vx *= FRICTION;
      ball.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, ball.vx));

      // Posun se dělí na dílky menší než kulička; jinak by při vyšší
      // rychlosti proletěla stěnou i ústím průchodu.
      const distance = Math.hypot(ball.vx, ball.vy);
      const steps = Math.max(1, Math.ceil(distance / 4));
      const stepX = ball.vx / steps;
      const stepY = ball.vy / steps;
      for (let i = 0; i < steps; i++) {
        if (substep(stepX, stepY)) break;
      }

      // Cíl a nástrahy.
      const tx = Math.floor(ball.x / TILE);
      const ty = Math.floor(ball.y / TILE);
      if (charAt(tx, ty) === '^') {
        reset();
        return;
      }
      if (Math.hypot(ball.x - state.goal.x, ball.y - state.goal.y) < TILE * 0.55) {
        state.levelDone = true;
        state.ticks = 0;
        // Míň pokusů, víc bodů.
        state.score += 400 + Math.max(0, 6 - state.attempts) * 100;
        return;
      }
      if (ball.y > state.height * TILE + 200 || ball.x < -200 || ball.x > state.width * TILE + 200) {
        reset();
      }
    },
  };
}
