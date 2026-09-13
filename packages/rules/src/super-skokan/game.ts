/**
 * Super skokan — plošinovka s během, skokem a dupnutím na nepřítele.
 *
 * Fyzika je sdílená (`../platform`), aby se skok choval stejně jako
 * v ostatních plošinovkách portálu. Vlastní je jen to, co dělá tuhle hru
 * touhle hrou: doba držení skoku, dupnutí a sbírání.
 */

import { BIT, isHeld, justPressed } from '../input-bits.js';
import {
  createBody, stepBody, overlaps, standingOn, hitsSolid,
  type Body, type TileGrid,
} from '../platform/index.js';
import { LEVELS, type LevelSpec } from './levels.js';

export const SKOKAN_RULES_VERSION = 1;

export const TILE = 24;
export const PLAYER_W = 16;
export const PLAYER_H = 22;

const RUN_ACCEL = 0.9;
const RUN_MAX = 4.4;
const FRICTION = 0.78;
const JUMP_VELOCITY = -10.2;
/** Kroků, po které držené tlačítko ještě přidává výšku skoku. */
const JUMP_HOLD_TICKS = 10;
const JUMP_HOLD_FORCE = -0.62;
/** Skok jde zmáčknout ještě chvíli po odstoupení z hrany. */
const COYOTE_TICKS = 6;
/** Skok zmáčknutý těsně před dopadem se provede po dopadu. */
const JUMP_BUFFER_TICKS = 8;
const STOMP_BOUNCE = -7.2;
const RESPAWN_TICKS = 60;

export type EnemyKind = 'chodec' | 'skokan';

export interface Enemy {
  body: Body;
  kind: EnemyKind;
  dir: 1 | -1;
  alive: boolean;
  /** Odpočet do dalšího poskoku u skokana. */
  timer: number;
}

export interface Coin {
  x: number;
  y: number;
  taken: boolean;
}

export interface SkokanState {
  level: number;
  width: number;
  height: number;
  rows: string[];
  player: Body;
  facing: 1 | -1;
  enemies: Enemy[];
  coins: Coin[];
  goal: { x: number; y: number };
  coyote: number;
  jumpBuffer: number;
  jumpHold: number;
  lives: number;
  score: number;
  /** Herní čas v krocích; do skóre se počítá zbytek časového limitu. */
  ticks: number;
  respawnTimer: number;
  levelDone: boolean;
  over: boolean;
  won: boolean;
  previousMask: number;
}

export interface SkokanGame {
  readonly state: SkokanState;
  readonly rulesVersion: number;
  readonly levels: LevelSpec[];
  readonly grid: TileGrid;
  step(mask: number): void;
  loadLevel(index: number): void;
}

/** Kolik kroků má hráč na úroveň, než přijde o život. */
export const LEVEL_TICKS = 90 * 60;

export function createSuperSkokan(seed: string, startLevel = 0): SkokanGame {
  void seed; // hra nemá náhodu

  const state: SkokanState = {
    level: 0,
    width: 0,
    height: 0,
    rows: [],
    player: createBody(0, 0, PLAYER_W, PLAYER_H),
    facing: 1,
    enemies: [],
    coins: [],
    goal: { x: 0, y: 0 },
    coyote: 0,
    jumpBuffer: 0,
    jumpHold: 0,
    lives: 3,
    score: 0,
    ticks: 0,
    respawnTimer: 0,
    levelDone: false,
    over: false,
    won: false,
    previousMask: 0,
  };

  const grid: TileGrid = {
    get width() { return state.width; },
    get height() { return state.height; },
    tile: TILE,
    solid(tx, ty) {
      if (tx < 0 || tx >= state.width) return true;
      if (ty < 0) return false;
      if (ty >= state.height) return false; // dole se propadá do prázdna
      const char = state.rows[ty]![tx] ?? '.';
      return char === '#' || char === '=';
    },
  };

  const charAt = (tx: number, ty: number): string => {
    if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return '.';
    return state.rows[ty]![tx] ?? '.';
  };

  /** Šlápl hráč na trny? Bere se střed jeho spodní hrany. */
  const onSpikes = (body: Body): boolean => {
    const tx = Math.floor((body.x + body.w / 2) / TILE);
    const ty = Math.floor((body.y + body.h - 1) / TILE);
    return charAt(tx, ty) === '^';
  };

  const loadLevel = (index: number): void => {
    const spec = LEVELS[index];
    if (!spec) return;

    state.level = index;
    state.rows = [...spec.rows];
    state.width = spec.rows[0]?.length ?? 0;
    state.height = spec.rows.length;
    state.enemies = [];
    state.coins = [];
    state.levelDone = false;
    state.ticks = 0;
    state.respawnTimer = 0;

    spec.rows.forEach((row, ty) => {
      [...row].forEach((char, tx) => {
        const px = tx * TILE;
        const py = ty * TILE;
        if (char === '@') {
          state.player = createBody(px + (TILE - PLAYER_W) / 2, py + TILE - PLAYER_H, PLAYER_W, PLAYER_H);
        } else if (char === 'o') {
          state.coins.push({ x: px + TILE / 2, y: py + TILE / 2, taken: false });
        } else if (char === 'e' || char === 's') {
          const body = createBody(px + 3, py + TILE - 18, 18, 18);
          // Chodci vyrážejí doprava, tedy pryč od startu hráče. Kdyby
          // šli doleva, první z nich do hráče vrazí dřív, než se rozkouká.
          state.enemies.push({
            body, kind: char === 'e' ? 'chodec' : 'skokan',
            dir: 1, alive: true, timer: 0,
          });
        } else if (char === 'F') {
          state.goal = { x: px, y: py };
        }
      });
    });
    state.facing = 1;
    state.coyote = 0;
    state.jumpBuffer = 0;
    state.jumpHold = 0;
  };

  const respawn = (): void => {
    state.lives--;
    if (state.lives <= 0) {
      state.over = true;
      return;
    }
    loadLevel(state.level);
    state.respawnTimer = RESPAWN_TICKS;
  };

  const stepEnemies = (): void => {
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;

      if (enemy.kind === 'chodec') {
        enemy.body.vx = enemy.dir * 1.25;
        // Na hraně se otočí, aby nespadl — chodec má hlídat plošinu.
        const aheadX = enemy.dir > 0 ? enemy.body.x + enemy.body.w + 2 : enemy.body.x - 2;
        const groundAhead = hitsSolid(grid, aheadX, enemy.body.y + enemy.body.h + 1, 1, 2);
        if (!groundAhead && standingOn(enemy.body, grid)) enemy.dir = enemy.dir > 0 ? -1 : 1;
      } else {
        enemy.body.vx = 0;
        if (standingOn(enemy.body, grid)) {
          if (--enemy.timer <= 0) {
            enemy.body.vy = -7.4;
            enemy.timer = 70;
          }
        }
      }

      stepBody(enemy.body, grid);
      if (enemy.body.hitWall) enemy.dir = enemy.dir > 0 ? -1 : 1;
      // Kdo spadne z mapy, zmizí — jinak by padal donekonečna.
      if (enemy.body.y > state.height * TILE + 200) enemy.alive = false;
    }
  };

  const collectCoins = (): void => {
    for (const coin of state.coins) {
      if (coin.taken) continue;
      const p = state.player;
      if (coin.x > p.x - 6 && coin.x < p.x + p.w + 6 && coin.y > p.y - 6 && coin.y < p.y + p.h + 6) {
        coin.taken = true;
        state.score += 100;
      }
    }
  };

  const resolveEnemies = (): void => {
    const p = state.player;
    for (const enemy of state.enemies) {
      if (!enemy.alive || !overlaps(p, enemy.body)) continue;

      // Dupnutí: hráč padá a je nad polovinou nepřítele.
      const stomping = p.vy > 0 && p.y + p.h - enemy.body.y < enemy.body.h * 0.6;
      if (stomping) {
        enemy.alive = false;
        p.vy = STOMP_BOUNCE;
        state.score += 200;
        continue;
      }
      respawn();
      return;
    }
  };

  loadLevel(startLevel);

  return {
    state,
    rulesVersion: SKOKAN_RULES_VERSION,
    levels: LEVELS,
    grid,
    loadLevel,

    step(mask) {
      const previous = state.previousMask;
      state.previousMask = mask;
      if (state.over || state.won) return;

      if (state.respawnTimer > 0) {
        state.respawnTimer--;
        return;
      }

      if (state.levelDone) {
        // Krátká oslava, pak další úroveň.
        if (++state.ticks % 80 === 0) {
          if (state.level + 1 >= LEVELS.length) state.won = true;
          else loadLevel(state.level + 1);
        }
        return;
      }

      state.ticks++;
      if (state.ticks > LEVEL_TICKS) {
        respawn();
        return;
      }

      const p = state.player;
      const left = isHeld(mask, BIT.left);
      const right = isHeld(mask, BIT.right);
      const jumpHeld = isHeld(mask, BIT.a) || isHeld(mask, BIT.up);
      const jumpPressed = justPressed(mask, previous, BIT.a) || justPressed(mask, previous, BIT.up);

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

      // Coyote time a buffer skoku: obojí jen odpouští nepřesnost o pár
      // snímků, ale bez nich působí plošinovka „tvrdě".
      if (p.onGround) state.coyote = COYOTE_TICKS;
      else if (state.coyote > 0) state.coyote--;
      if (jumpPressed) state.jumpBuffer = JUMP_BUFFER_TICKS;
      else if (state.jumpBuffer > 0) state.jumpBuffer--;

      if (state.jumpBuffer > 0 && state.coyote > 0) {
        p.vy = JUMP_VELOCITY;
        state.jumpHold = JUMP_HOLD_TICKS;
        state.jumpBuffer = 0;
        state.coyote = 0;
      } else if (state.jumpHold > 0 && jumpHeld && p.vy < 0) {
        // Držení prodlouží skok; puštění ho ukončí.
        p.vy += JUMP_HOLD_FORCE;
        state.jumpHold--;
      } else {
        state.jumpHold = 0;
      }

      stepBody(p, grid);
      stepEnemies();
      collectCoins();

      if (onSpikes(p)) {
        respawn();
        return;
      }
      // Pád z mapy.
      if (p.y > state.height * TILE + 60) {
        respawn();
        return;
      }

      resolveEnemies();
      if (state.over) return;

      // Cíl: stačí se dotknout vlajky.
      const goalHit = p.x + p.w > state.goal.x && p.x < state.goal.x + TILE
        && p.y + p.h > state.goal.y && p.y < state.goal.y + TILE * 2;
      if (goalHit) {
        state.levelDone = true;
        state.score += 500 + Math.max(0, Math.floor((LEVEL_TICKS - state.ticks) / 60)) * 10;
      }
    },
  };
}
