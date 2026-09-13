/**
 * Lovec území — hráč ukrajuje volnou plochu tím, že ji obkresluje.
 *
 * Mechanika: po zabrané ploše se chodí bezpečně. Krok do volné plochy
 * začne stopu; jakmile se stopa vrátí na zabranou plochu, uzavřená oblast
 * se zabere — ale jen ta část, kam se nedostane žádný nepřítel. Šlápnutí
 * na vlastní stopu nebo dotek nepřítele stojí život.
 *
 * Vše je celočíselné a řízené seedem, takže server umí běh přehrát (D-008).
 */

import { createRng, type Rng } from '@vevit-games/engine/core';
import { BIT, isHeld } from '../input-bits.js';

export const LOVEC_RULES_VERSION = 1;

export const GRID_W = 32;
export const GRID_H = 22;

/** Podíl zabrané plochy, po kterém úroveň končí. */
export const WIN_RATIO = 0.78;

export type Cell = 'volno' | 'zabrano' | 'stopa';
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Point { x: number; y: number }

export interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Lovec chodí po zabrané ploše a smaže stopu, kterou potká. */
  kind: 'volny' | 'lovec';
}

export interface LovecState {
  cells: Cell[];
  player: Point;
  /** Směr, kterým hráč jde; `null` = stojí. */
  direction: Dir | null;
  /** Pole stopy v pořadí, jak vznikala. */
  trail: Point[];
  enemies: Enemy[];
  level: number;
  lives: number;
  score: number;
  /** Podíl zabrané plochy 0–1. */
  filled: number;
  moveTimer: number;
  /** Nehybnost po ztrátě života. */
  respawnTimer: number;
  tick: number;
  over: boolean;
  levelDone: boolean;
  previousMask: number;
}

export interface LovecGame {
  readonly state: LovecState;
  readonly rulesVersion: number;
  step(mask: number): void;
  cellAt(x: number, y: number): Cell;
  index(x: number, y: number): number;
  loadLevel(level: number): void;
}

/** Kroků mezi posuny hráče o pole. */
const MOVE_INTERVAL = 5;
const RESPAWN_TICKS = 70;
/** Okraj zabraný na začátku — hráč má kde stát. */
const BORDER = 1;

const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

export function createLovecUzemi(seed: string, startLevel = 0): LovecGame {
  const rng: Rng = createRng(seed);

  const state: LovecState = {
    cells: [],
    player: { x: 0, y: 0 },
    direction: null,
    trail: [],
    enemies: [],
    level: 0,
    lives: 3,
    score: 0,
    filled: 0,
    moveTimer: 0,
    respawnTimer: 0,
    tick: 0,
    over: false,
    levelDone: false,
    previousMask: 0,
  };

  const index = (x: number, y: number): number => y * GRID_W + x;
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < GRID_W && y < GRID_H;
  const cellAt = (x: number, y: number): Cell => (inside(x, y) ? state.cells[index(x, y)]! : 'zabrano');

  const countFilled = (): void => {
    let filled = 0;
    for (const cell of state.cells) if (cell === 'zabrano') filled++;
    state.filled = filled / (GRID_W * GRID_H);
  };

  const loadLevel = (level: number): void => {
    state.level = level;
    state.cells = Array.from({ length: GRID_W * GRID_H }, (_, i) => {
      const x = i % GRID_W;
      const y = Math.floor(i / GRID_W);
      const edge = x < BORDER || y < BORDER || x >= GRID_W - BORDER || y >= GRID_H - BORDER;
      return edge ? 'zabrano' : 'volno';
    });
    state.player = { x: Math.floor(GRID_W / 2), y: 0 };
    state.direction = null;
    state.trail = [];
    state.levelDone = false;
    state.moveTimer = 0;
    state.respawnTimer = 0;

    // S úrovní přibývá nepřátel a jeden lovec navíc každou druhou.
    const free = 2 + level;
    const hunters = Math.floor(level / 2);
    state.enemies = [];
    for (let i = 0; i < free; i++) {
      state.enemies.push({
        x: rng.int(4, GRID_W - 4) + 0.5,
        y: rng.int(4, GRID_H - 4) + 0.5,
        vx: rng.chance(0.5) ? 0.34 : -0.34,
        vy: rng.chance(0.5) ? 0.34 : -0.34,
        kind: 'volny',
      });
    }
    for (let i = 0; i < hunters; i++) {
      state.enemies.push({
        x: BORDER + 0.5, y: rng.int(2, GRID_H - 2) + 0.5,
        vx: 0.22, vy: 0.22, kind: 'lovec',
      });
    }
    countFilled();
  };

  /** Vrátí hráče na okraj a smaže rozdělanou stopu. */
  const resetPlayer = (): void => {
    for (const p of state.trail) state.cells[index(p.x, p.y)] = 'volno';
    state.trail = [];
    state.direction = null;
    state.player = { x: Math.floor(GRID_W / 2), y: 0 };
    state.respawnTimer = RESPAWN_TICKS;
  };

  const loseLife = (): void => {
    state.lives--;
    if (state.lives <= 0) {
      state.over = true;
      return;
    }
    resetPlayer();
  };

  /**
   * Uzavře stopu: zabere ji a k ní všechna volná pole, ke kterým se
   * nedostane žádný nepřítel. Záplava se pouští od nepřátel, ne od stopy —
   * jinak by se muselo hádat, která z odříznutých oblastí je „vnitřek".
   */
  const closeTrail = (): void => {
    for (const p of state.trail) state.cells[index(p.x, p.y)] = 'zabrano';
    state.trail = [];

    const reachable = new Uint8Array(GRID_W * GRID_H);
    const queue: number[] = [];
    for (const enemy of state.enemies) {
      if (enemy.kind === 'lovec') continue;
      const ex = Math.floor(enemy.x);
      const ey = Math.floor(enemy.y);
      if (!inside(ex, ey)) continue;
      const i = index(ex, ey);
      if (state.cells[i] !== 'volno' || reachable[i]) continue;
      reachable[i] = 1;
      queue.push(i);
    }

    while (queue.length > 0) {
      const current = queue.pop()!;
      const cx = current % GRID_W;
      const cy = Math.floor(current / GRID_W);
      for (const d of Object.values(DELTA)) {
        const nx = cx + d.x;
        const ny = cy + d.y;
        if (!inside(nx, ny)) continue;
        const ni = index(nx, ny);
        if (reachable[ni] || state.cells[ni] !== 'volno') continue;
        reachable[ni] = 1;
        queue.push(ni);
      }
    }

    let gained = 0;
    for (let i = 0; i < state.cells.length; i++) {
      if (state.cells[i] === 'volno' && !reachable[i]) {
        state.cells[i] = 'zabrano';
        gained++;
      }
    }
    state.score += gained * 10;
    countFilled();
    if (state.filled >= WIN_RATIO) state.levelDone = true;
  };

  const movePlayer = (): void => {
    if (!state.direction) return;
    const d = DELTA[state.direction];
    const nx = state.player.x + d.x;
    const ny = state.player.y + d.y;
    if (!inside(nx, ny)) {
      state.direction = null;
      return;
    }

    const target = cellAt(nx, ny);
    if (target === 'stopa') {
      // Šlápnutí do vlastní stopy.
      loseLife();
      return;
    }

    const from = cellAt(state.player.x, state.player.y);
    state.player = { x: nx, y: ny };

    if (target === 'volno') {
      state.cells[index(nx, ny)] = 'stopa';
      state.trail.push({ x: nx, y: ny });
      return;
    }

    // Došli jsme na zabranou plochu. Pokud za námi je stopa, uzavře se.
    if (from === 'stopa' && state.trail.length > 0) {
      closeTrail();
      state.direction = null;
    }
  };

  const moveEnemies = (): void => {
    for (const enemy of state.enemies) {
      if (enemy.kind === 'lovec') {
        // Lovec se drží zabrané plochy a maže stopu, kterou potká.
        const nx = enemy.x + enemy.vx;
        const ny = enemy.y + enemy.vy;
        if (cellAt(Math.floor(nx), Math.floor(enemy.y)) !== 'zabrano') enemy.vx = -enemy.vx;
        else enemy.x = nx;
        if (cellAt(Math.floor(enemy.x), Math.floor(ny)) !== 'zabrano') enemy.vy = -enemy.vy;
        else enemy.y = ny;
        continue;
      }

      const nx = enemy.x + enemy.vx;
      const ny = enemy.y + enemy.vy;
      if (cellAt(Math.floor(nx), Math.floor(enemy.y)) !== 'volno') enemy.vx = -enemy.vx;
      else enemy.x = nx;
      if (cellAt(Math.floor(enemy.x), Math.floor(ny)) !== 'volno') enemy.vy = -enemy.vy;
      else enemy.y = ny;
    }
  };

  /** Dotkl se nepřítel hráče nebo jeho stopy? */
  const checkHits = (): boolean => {
    for (const enemy of state.enemies) {
      const ex = Math.floor(enemy.x);
      const ey = Math.floor(enemy.y);
      if (ex === state.player.x && ey === state.player.y) return true;
      if (cellAt(ex, ey) === 'stopa') return true;
    }
    return false;
  };

  loadLevel(startLevel);

  return {
    state,
    rulesVersion: LOVEC_RULES_VERSION,
    index,
    cellAt,
    loadLevel,

    step(mask) {
      state.previousMask = mask;
      if (state.over) return;
      state.tick++;

      if (state.levelDone) {
        // Krátká pauza, pak další úroveň.
        if (state.tick % 90 === 0) {
          state.score += 500;
          loadLevel(state.level + 1);
        }
        return;
      }

      if (state.respawnTimer > 0) {
        state.respawnTimer--;
        return;
      }

      // Směr se drží, dokud hráč nezvolí jiný — jinak by se v mřížce
      // muselo trefovat do okamžiku kroku.
      if (isHeld(mask, BIT.left)) state.direction = 'left';
      else if (isHeld(mask, BIT.right)) state.direction = 'right';
      else if (isHeld(mask, BIT.up)) state.direction = 'up';
      else if (isHeld(mask, BIT.down)) state.direction = 'down';

      if (++state.moveTimer >= MOVE_INTERVAL) {
        state.moveTimer = 0;
        movePlayer();
      }

      moveEnemies();
      if (checkHits()) loseLife();
    },
  };
}
