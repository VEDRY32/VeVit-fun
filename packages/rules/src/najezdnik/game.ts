/**
 * Nájezdník — plošinovka se střelbou.
 *
 * Hráč má život, ne okamžitou smrt: zásah ubere a na chvíli udělá
 * nezranitelnost, aby se dalo vycouvat. Cíl je projít na východ.
 *
 * Fyzika je sdílená (`../platform`).
 */

import { BIT, isHeld, justPressed } from '../input-bits.js';
import {
  createBody, stepBody, hitsSolid, overlaps, standingOn,
  type Body, type TileGrid,
} from '../platform/index.js';
import { LEVELS, type LevelSpec } from './levels.js';

export const NAJEZDNIK_RULES_VERSION = 1;

export const TILE = 24;
export const HERO_W = 16;
export const HERO_H = 22;
export const MAX_HEALTH = 6;

const RUN_ACCEL = 0.85;
const RUN_MAX = 4.1;
const FRICTION = 0.78;
const JUMP_VELOCITY = -9.8;
const COYOTE_TICKS = 6;
const SHOT_SPEED = 7.5;
const FIRE_INTERVAL = 11;
const HURT_TICKS = 50;
const START_AMMO = 30;

export type EnemyKind = 'chodec' | 'vez';

export interface Enemy {
  kind: EnemyKind;
  body: Body;
  dir: 1 | -1;
  hp: number;
  cooldown: number;
  alive: boolean;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
}

export interface Pickup {
  kind: 'lekarna' | 'naboje';
  x: number;
  y: number;
  taken: boolean;
}

export interface NajezdnikState {
  level: number;
  width: number;
  height: number;
  rows: string[];
  player: Body;
  facing: 1 | -1;
  health: number;
  ammo: number;
  hurtTicks: number;
  fireTimer: number;
  coyote: number;
  enemies: Enemy[];
  shots: Shot[];
  pickups: Pickup[];
  exit: { x: number; y: number };
  score: number;
  ticks: number;
  levelDone: boolean;
  over: boolean;
  won: boolean;
  previousMask: number;
}

export interface NajezdnikGame {
  readonly state: NajezdnikState;
  readonly rulesVersion: number;
  readonly levels: LevelSpec[];
  readonly grid: TileGrid;
  step(mask: number): void;
  loadLevel(index: number): void;
}

export function createNajezdnik(seed: string, startLevel = 0): NajezdnikGame {
  void seed; // hra nemá náhodu, nepřátelé jednají podle stavu

  const state: NajezdnikState = {
    level: 0,
    width: 0,
    height: 0,
    rows: [],
    player: createBody(0, 0, HERO_W, HERO_H),
    facing: 1,
    health: MAX_HEALTH,
    ammo: START_AMMO,
    hurtTicks: 0,
    fireTimer: 0,
    coyote: 0,
    enemies: [],
    shots: [],
    pickups: [],
    exit: { x: 0, y: 0 },
    score: 0,
    ticks: 0,
    levelDone: false,
    over: false,
    won: false,
    previousMask: 0,
  };

  const charAt = (tx: number, ty: number): string => {
    if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return '.';
    return state.rows[ty]![tx] ?? '.';
  };

  const grid: TileGrid = {
    get width() { return state.width; },
    get height() { return state.height; },
    tile: TILE,
    solid(tx, ty) {
      if (tx < 0 || tx >= state.width) return true;
      if (ty < 0) return false;
      if (ty >= state.height) return false;
      const char = charAt(tx, ty);
      return char === '#' || char === '=';
    },
  };

  const loadLevel = (index: number): void => {
    const spec = LEVELS[index];
    if (!spec) return;

    state.level = index;
    state.rows = [...spec.rows];
    state.width = spec.rows[0]?.length ?? 0;
    state.height = spec.rows.length;
    state.enemies = [];
    state.shots = [];
    state.pickups = [];
    state.levelDone = false;
    state.ticks = 0;
    state.hurtTicks = 0;

    spec.rows.forEach((row, ty) => {
      [...row].forEach((char, tx) => {
        const px = tx * TILE;
        const py = ty * TILE;
        if (char === '@') {
          state.player = createBody(px + 4, py + TILE - HERO_H, HERO_W, HERO_H);
        } else if (char === 'X') {
          state.exit = { x: px, y: py };
        } else if (char === 'v' || char === 't') {
          const kind: EnemyKind = char === 'v' ? 'chodec' : 'vez';
          state.enemies.push({
            kind,
            body: createBody(px + 4, py + TILE - 20, 16, 20),
            dir: 1,
            hp: kind === 'vez' ? 4 : 2,
            cooldown: kind === 'vez' ? 60 : 100,
            alive: true,
          });
        } else if (char === 'h') {
          state.pickups.push({ kind: 'lekarna', x: px + TILE / 2, y: py + TILE / 2, taken: false });
        } else if (char === 'n') {
          state.pickups.push({ kind: 'naboje', x: px + TILE / 2, y: py + TILE / 2, taken: false });
        }
      });
    });
  };

  const hurt = (amount: number): void => {
    if (state.hurtTicks > 0) return;
    state.health -= amount;
    state.hurtTicks = HURT_TICKS;
    if (state.health <= 0) {
      state.health = 0;
      state.over = true;
    }
  };

  const onSpikes = (body: Body): boolean => {
    const tx = Math.floor((body.x + body.w / 2) / TILE);
    const ty = Math.floor((body.y + body.h - 1) / TILE);
    return charAt(tx, ty) === '^';
  };

  /** Vidí nepřítel hráče? Stačí přibližně stejná výška a rozumná dálka. */
  const seesPlayer = (enemy: Enemy): boolean => {
    const dy = Math.abs((enemy.body.y + enemy.body.h / 2) - (state.player.y + state.player.h / 2));
    const dx = Math.abs((enemy.body.x + enemy.body.w / 2) - (state.player.x + state.player.w / 2));
    return dy < TILE * 1.2 && dx < TILE * 12;
  };

  const enemyShoot = (enemy: Enemy): void => {
    const dir = state.player.x + state.player.w / 2 > enemy.body.x + enemy.body.w / 2 ? 1 : -1;
    state.shots.push({
      x: enemy.body.x + enemy.body.w / 2 + dir * 12,
      y: enemy.body.y + enemy.body.h * 0.4,
      vx: dir * 4.2,
      vy: 0,
      fromPlayer: false,
    });
  };

  loadLevel(startLevel);

  return {
    state,
    rulesVersion: NAJEZDNIK_RULES_VERSION,
    levels: LEVELS,
    grid,
    loadLevel,

    step(mask) {
      const previous = state.previousMask;
      state.previousMask = mask;
      if (state.over || state.won) return;

      if (state.levelDone) {
        if (++state.ticks % 80 === 0) {
          if (state.level + 1 >= LEVELS.length) state.won = true;
          else loadLevel(state.level + 1);
        }
        return;
      }

      state.ticks++;
      if (state.hurtTicks > 0) state.hurtTicks--;
      if (state.fireTimer > 0) state.fireTimer--;

      // --- Hráč ---
      const p = state.player;
      const left = isHeld(mask, BIT.left);
      const right = isHeld(mask, BIT.right);
      if (left && !right) {
        p.vx = Math.max(-RUN_MAX, p.vx - RUN_ACCEL);
        state.facing = -1;
      } else if (right && !left) {
        p.vx = Math.min(RUN_MAX, p.vx + RUN_ACCEL);
        state.facing = 1;
      } else {
        p.vx *= FRICTION;
        if (Math.abs(p.vx) < 0.08) p.vx = 0;
      }

      if (p.onGround) state.coyote = COYOTE_TICKS;
      else if (state.coyote > 0) state.coyote--;
      if (justPressed(mask, previous, BIT.up) && state.coyote > 0) {
        p.vy = JUMP_VELOCITY;
        state.coyote = 0;
      }

      if (isHeld(mask, BIT.a) && state.fireTimer === 0 && state.ammo > 0) {
        state.ammo--;
        state.fireTimer = FIRE_INTERVAL;
        // Se šipkou nahoru se pálí vzhůru, jinak po směru pohledu.
        const up = isHeld(mask, BIT.up);
        state.shots.push({
          x: p.x + p.w / 2 + (up ? 0 : state.facing * 10),
          y: p.y + p.h * 0.4,
          vx: up ? 0 : state.facing * SHOT_SPEED,
          vy: up ? -SHOT_SPEED : 0,
          fromPlayer: true,
        });
      }

      stepBody(p, grid);

      // --- Nepřátelé ---
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;

        if (enemy.kind === 'chodec') {
          enemy.body.vx = enemy.dir * 1.1;
          const aheadX = enemy.dir > 0 ? enemy.body.x + enemy.body.w + 2 : enemy.body.x - 2;
          const ground = hitsSolid(grid, aheadX, enemy.body.y + enemy.body.h + 1, 1, 2);
          if (!ground && standingOn(enemy.body, grid)) enemy.dir = enemy.dir > 0 ? -1 : 1;
        } else {
          enemy.body.vx = 0;
        }

        stepBody(enemy.body, grid);
        if (enemy.body.hitWall) enemy.dir = enemy.dir > 0 ? -1 : 1;

        if (--enemy.cooldown <= 0 && seesPlayer(enemy)) {
          enemy.cooldown = enemy.kind === 'vez' ? 70 : 110;
          enemyShoot(enemy);
        }

        if (overlaps(p, enemy.body)) hurt(1);
      }

      // --- Střely ---
      for (const shot of state.shots) {
        shot.x += shot.vx;
        shot.y += shot.vy;
      }
      state.shots = state.shots.filter((shot) => {
        if (hitsSolid(grid, shot.x - 2, shot.y - 2, 4, 4)) return false;
        if (shot.x < -20 || shot.x > state.width * TILE + 20) return false;
        if (shot.y < -20 || shot.y > state.height * TILE + 20) return false;

        if (shot.fromPlayer) {
          for (const enemy of state.enemies) {
            if (!enemy.alive) continue;
            const b = enemy.body;
            if (shot.x < b.x || shot.x > b.x + b.w || shot.y < b.y || shot.y > b.y + b.h) continue;
            if (--enemy.hp <= 0) {
              enemy.alive = false;
              state.score += enemy.kind === 'vez' ? 150 : 80;
            }
            return false;
          }
          return true;
        }

        if (shot.x > p.x && shot.x < p.x + p.w && shot.y > p.y && shot.y < p.y + p.h) {
          hurt(1);
          return false;
        }
        return true;
      });

      // --- Sběr ---
      for (const pickup of state.pickups) {
        if (pickup.taken) continue;
        if (pickup.x < p.x - 6 || pickup.x > p.x + p.w + 6) continue;
        if (pickup.y < p.y - 6 || pickup.y > p.y + p.h + 6) continue;
        pickup.taken = true;
        if (pickup.kind === 'lekarna') state.health = Math.min(MAX_HEALTH, state.health + 2);
        else state.ammo += 20;
        state.score += 50;
      }

      if (onSpikes(p)) hurt(2);
      if (p.y > state.height * TILE + 60) {
        state.health = 0;
        state.over = true;
        return;
      }
      if (state.over) return;

      const atExit = p.x + p.w > state.exit.x && p.x < state.exit.x + TILE
        && p.y + p.h > state.exit.y && p.y < state.exit.y + TILE;
      if (atExit) {
        state.levelDone = true;
        state.ticks = 0;
        state.score += 400 + state.health * 50;
      }
    },
  };
}
