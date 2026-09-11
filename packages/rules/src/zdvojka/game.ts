/**
 * Zdvojka — posouvání a slučování čísel na mřížce.
 *
 * Deterministická: nové dlaždice vznikají ze seedu, takže denní seed dá všem
 * hráčům stejnou hru a server umí běh přehrát.
 */

import { createRng, type Rng } from '@vevit-games/engine';
import { BIT, justPressed } from '../input-bits.js';

export const ZDVOJKA_RULES_VERSION = 1;

export type Direction = 'left' | 'right' | 'up' | 'down';
export type ZdvojkaMode = 'klasik' | 'pohodovy' | 'denni' | 'casovka';

export interface Tile {
  /** Stabilní identita pro animaci přesunu mezi kroky. */
  id: number;
  value: number;
  x: number;
  y: number;
  /** Kam se dlaždice posunula v posledním tahu — pro interpolaci. */
  fromX: number;
  fromY: number;
  /** Vznikla sloučením — vykreslí se s „pop" efektem. */
  merged: boolean;
  /** Objevila se v tomto tahu. */
  spawned: boolean;
}

export interface ZdvojkaConfig {
  size: number;
  mode: ZdvojkaMode;
  /** Časový limit v krocích logiky; 0 = bez limitu. */
  timeLimitTicks: number;
}

export interface ZdvojkaState {
  tiles: Tile[];
  score: number;
  moves: number;
  tick: number;
  over: boolean;
  won: boolean;
  /** Nejvyšší dosažená hodnota — cíl je 2048. */
  best: number;
  undoUsed: boolean;
  previousMask: number;
}

export interface ZdvojkaGame {
  readonly state: ZdvojkaState;
  readonly config: ZdvojkaConfig;
  readonly rulesVersion: number;
  step(mask: number): void;
  /** Provede tah přímo — pro dotykové gesto. */
  move(direction: Direction): boolean;
  /** Krok zpět; jen v pohodovém režimu a jen jednou po sobě. */
  undo(): boolean;
  /** Mřížka hodnot pro vykreslení a testy. */
  grid(): number[][];
}

const DEFAULT_CONFIG: ZdvojkaConfig = { size: 4, mode: 'klasik', timeLimitTicks: 0 };

export function createZdvojka(seed: string, config: Partial<ZdvojkaConfig> = {}): ZdvojkaGame {
  const cfg: ZdvojkaConfig = { ...DEFAULT_CONFIG, ...config };
  const rng: Rng = createRng(seed);
  let nextId = 1;

  const state: ZdvojkaState = {
    tiles: [],
    score: 0,
    moves: 0,
    tick: 0,
    over: false,
    won: false,
    best: 0,
    undoUsed: false,
    previousMask: 0,
  };

  let snapshot: { tiles: Tile[]; score: number; best: number } | null = null;

  const at = (x: number, y: number): Tile | undefined =>
    state.tiles.find((t) => t.x === x && t.y === y);

  const emptyCells = (): { x: number; y: number }[] => {
    const cells: { x: number; y: number }[] = [];
    for (let y = 0; y < cfg.size; y++) {
      for (let x = 0; x < cfg.size; x++) {
        if (!at(x, y)) cells.push({ x, y });
      }
    }
    return cells;
  };

  const spawnTile = (): void => {
    const cells = emptyCells();
    if (cells.length === 0) return;
    const cell = cells[rng.int(0, cells.length)]!;
    // Čtyřka v jednom případě z deseti — drží hru o něco těžší.
    state.tiles.push({
      id: nextId++,
      value: rng.chance(0.9) ? 2 : 4,
      x: cell.x, y: cell.y,
      fromX: cell.x, fromY: cell.y,
      merged: false, spawned: true,
    });
  };

  /** Pořadí průchodu: vždy od té stěny, ke které se posouvá. */
  const traversal = (direction: Direction): { xs: number[]; ys: number[] } => {
    const asc = Array.from({ length: cfg.size }, (_, i) => i);
    const desc = [...asc].reverse();
    switch (direction) {
      case 'left': return { xs: asc, ys: asc };
      case 'right': return { xs: desc, ys: asc };
      case 'up': return { xs: asc, ys: asc };
      case 'down': return { xs: asc, ys: desc };
    }
  };

  const vector = (direction: Direction): { dx: number; dy: number } => {
    switch (direction) {
      case 'left': return { dx: -1, dy: 0 };
      case 'right': return { dx: 1, dy: 0 };
      case 'up': return { dx: 0, dy: -1 };
      case 'down': return { dx: 0, dy: 1 };
    }
  };

  const movesAvailable = (): boolean => {
    if (emptyCells().length > 0) return true;
    for (let y = 0; y < cfg.size; y++) {
      for (let x = 0; x < cfg.size; x++) {
        const tile = at(x, y);
        if (!tile) continue;
        const right = at(x + 1, y);
        const down = at(x, y + 1);
        if (right?.value === tile.value || down?.value === tile.value) return true;
      }
    }
    return false;
  };

  const performMove = (direction: Direction): boolean => {
    if (state.over) return false;

    const before = state.tiles.map((t) => ({ ...t }));
    const { dx, dy } = vector(direction);
    const { xs, ys } = traversal(direction);
    // Sloučená dlaždice se v témže tahu už neslučuje podruhé.
    const mergedThisMove = new Set<number>();
    let moved = false;

    for (const tile of state.tiles) {
      tile.fromX = tile.x;
      tile.fromY = tile.y;
      tile.merged = false;
      tile.spawned = false;
    }

    for (const y of ys) {
      for (const x of xs) {
        const tile = at(x, y);
        if (!tile) continue;

        let nx = tile.x;
        let ny = tile.y;
        for (;;) {
          const tx = nx + dx;
          const ty = ny + dy;
          if (tx < 0 || ty < 0 || tx >= cfg.size || ty >= cfg.size) break;
          const target = at(tx, ty);
          if (!target) {
            nx = tx;
            ny = ty;
            continue;
          }
          if (target.value === tile.value && !mergedThisMove.has(target.id) && !mergedThisMove.has(tile.id)) {
            target.value *= 2;
            target.merged = true;
            mergedThisMove.add(target.id);
            state.score += target.value;
            state.best = Math.max(state.best, target.value);
            if (target.value >= 2048) state.won = true;
            state.tiles = state.tiles.filter((t) => t.id !== tile.id);
            moved = true;
            nx = -1; // dlaždice zanikla
          }
          break;
        }

        if (nx !== -1 && (nx !== tile.x || ny !== tile.y)) {
          tile.x = nx;
          tile.y = ny;
          moved = true;
        }
      }
    }

    if (!moved) return false;

    if (cfg.mode === 'pohodovy') {
      snapshot = { tiles: before, score: state.score, best: state.best };
      state.undoUsed = false;
    }

    state.moves++;
    spawnTile();
    if (!movesAvailable()) state.over = true;
    return true;
  };

  const game: ZdvojkaGame = {
    state,
    config: cfg,
    rulesVersion: ZDVOJKA_RULES_VERSION,

    step(mask) {
      const previous = state.previousMask;
      state.previousMask = mask;
      if (state.over) return;
      state.tick++;

      if (cfg.timeLimitTicks > 0 && state.tick >= cfg.timeLimitTicks) {
        state.over = true;
        return;
      }

      if (justPressed(mask, previous, BIT.left)) performMove('left');
      else if (justPressed(mask, previous, BIT.right)) performMove('right');
      else if (justPressed(mask, previous, BIT.up)) performMove('up');
      else if (justPressed(mask, previous, BIT.down)) performMove('down');
    },

    move: performMove,

    undo() {
      // Hodnocený režim krok zpět nemá — jinak by rekordy nic neznamenaly.
      if (cfg.mode !== 'pohodovy' || !snapshot || state.undoUsed) return false;
      state.tiles = snapshot.tiles.map((t) => ({ ...t }));
      state.score = snapshot.score;
      state.best = snapshot.best;
      state.over = false;
      state.undoUsed = true;
      state.moves = Math.max(0, state.moves - 1);
      return true;
    },

    grid() {
      const out = Array.from({ length: cfg.size }, () => Array<number>(cfg.size).fill(0));
      for (const tile of state.tiles) out[tile.y]![tile.x] = tile.value;
      return out;
    },
  };

  spawnTile();
  spawnTile();
  return game;
}
