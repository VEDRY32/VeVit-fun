/**
 * Kostka — kvádr 1×1×2 se převaluje po dlaždicích a má spadnout do díry.
 *
 * Pravidla jsou čistě celočíselná a bez náhody: stejná posloupnost tahů dá
 * vždy stejný výsledek, takže server dokáže běh přehrát (D-008).
 */

import { BIT, justPressed } from '../input-bits.js';
import { LEVELS, type LevelSpec } from './levels.js';

export const KOSTKA_RULES_VERSION = 1;

export type Tile = 'prazdno' | 'pevna' | 'krehka' | 'spinac' | 'most' | 'cil';
export type Orientation = 'stojici' | 'lezici-x' | 'lezici-y';
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Point { x: number; y: number }

export interface Block {
  /** Levý horní obsazený sloupec/řádek. U stojící kostky je to celá kostka. */
  x: number;
  y: number;
  orientation: Orientation;
}

export interface KostkaState {
  level: number;
  width: number;
  height: number;
  tiles: Tile[];
  /** Most je průchozí, jen když je zapnutý. Index odpovídá `tiles`. */
  bridgeOn: boolean[];
  /** Křehká dlaždice, která už praskla. */
  broken: boolean[];
  block: Block;
  moves: number;
  /** Celkem tahů za celou hru — to je skóre. */
  totalMoves: number;
  /** Krok, ve kterém kostka spadla; drží animaci pádu. */
  fallTicks: number;
  lost: boolean;
  solved: boolean;
  /** Všechny úrovně hotové. */
  won: boolean;
  tick: number;
  previousMask: number;
}

export interface KostkaGame {
  readonly state: KostkaState;
  readonly rulesVersion: number;
  readonly levels: LevelSpec[];
  step(mask: number): void;
  /** Tah přímo — pro dotykové ovládání. */
  move(direction: Dir): boolean;
  /** Načte úroveň znovu; počítá se to jako prohra, ne jako nový běh. */
  restartLevel(): void;
  loadLevel(index: number): void;
  /** Pole obsazená kostkou. */
  blockCells(): Point[];
  tileAt(x: number, y: number): Tile;
  index(x: number, y: number): number;
}

/** Kolik kroků trvá pád, než se úroveň vyhodnotí. */
export const FALL_TICKS = 26;

const TILE_FROM_CHAR: Record<string, Tile> = {
  ' ': 'prazdno',
  '#': 'pevna',
  '@': 'pevna',
  k: 'krehka',
  s: 'spinac',
  m: 'most',
  M: 'most',
  o: 'cil',
};

export function createKostka(seed: string, startLevel = 0): KostkaGame {
  void seed; // hra nemá náhodu; seed drží jen tvar rozhraní

  const state: KostkaState = {
    level: 0,
    width: 0,
    height: 0,
    tiles: [],
    bridgeOn: [],
    broken: [],
    block: { x: 0, y: 0, orientation: 'stojici' },
    moves: 0,
    totalMoves: 0,
    fallTicks: 0,
    lost: false,
    solved: false,
    won: false,
    tick: 0,
    previousMask: 0,
  };

  const index = (x: number, y: number): number => y * state.width + x;

  const inside = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < state.width && y < state.height;

  const tileAt = (x: number, y: number): Tile => {
    if (!inside(x, y)) return 'prazdno';
    return state.tiles[index(x, y)] ?? 'prazdno';
  };

  /** Unese dlaždice kostku? Rozbitá křehká ani vypnutý most ne. */
  const solid = (x: number, y: number): boolean => {
    if (!inside(x, y)) return false;
    const i = index(x, y);
    const tile = state.tiles[i]!;
    if (tile === 'prazdno') return false;
    if (tile === 'krehka' && state.broken[i]) return false;
    if (tile === 'most' && !state.bridgeOn[i]) return false;
    return true;
  };

  const blockCells = (): Point[] => {
    const { x, y, orientation } = state.block;
    if (orientation === 'stojici') return [{ x, y }];
    if (orientation === 'lezici-x') return [{ x, y }, { x: x + 1, y }];
    return [{ x, y }, { x, y: y + 1 }];
  };

  const loadLevel = (levelIndex: number): void => {
    const spec = LEVELS[levelIndex];
    if (!spec) return;

    state.level = levelIndex;
    state.width = spec.rows[0]?.length ?? 0;
    state.height = spec.rows.length;
    state.tiles = [];
    state.bridgeOn = [];
    state.broken = [];
    state.moves = 0;
    state.fallTicks = 0;
    state.lost = false;
    state.solved = false;

    spec.rows.forEach((row, y) => {
      [...row].forEach((char, x) => {
        state.tiles.push(TILE_FROM_CHAR[char] ?? 'prazdno');
        state.bridgeOn.push(char === 'M');
        state.broken.push(false);
        if (char === '@') state.block = { x, y, orientation: 'stojici' };
      });
    });
  };

  /** Přepne všechny mosty v úrovni. */
  const toggleBridges = (): void => {
    for (let i = 0; i < state.tiles.length; i++) {
      if (state.tiles[i] === 'most') state.bridgeOn[i] = !state.bridgeOn[i];
    }
  };

  /** Kam se kostka převalí. Vrací nový stav bez ohledu na to, co je pod ním. */
  const rolled = (direction: Dir): Block => {
    const { x, y, orientation } = state.block;
    if (direction === 'right') {
      if (orientation === 'stojici') return { x: x + 1, y, orientation: 'lezici-x' };
      if (orientation === 'lezici-x') return { x: x + 2, y, orientation: 'stojici' };
      return { x: x + 1, y, orientation: 'lezici-y' };
    }
    if (direction === 'left') {
      if (orientation === 'stojici') return { x: x - 2, y, orientation: 'lezici-x' };
      if (orientation === 'lezici-x') return { x: x - 1, y, orientation: 'stojici' };
      return { x: x - 1, y, orientation: 'lezici-y' };
    }
    if (direction === 'down') {
      if (orientation === 'stojici') return { x, y: y + 1, orientation: 'lezici-y' };
      if (orientation === 'lezici-y') return { x, y: y + 2, orientation: 'stojici' };
      return { x, y: y + 1, orientation: 'lezici-x' };
    }
    if (orientation === 'stojici') return { x, y: y - 2, orientation: 'lezici-y' };
    if (orientation === 'lezici-y') return { x, y: y - 1, orientation: 'stojici' };
    return { x, y: y - 1, orientation: 'lezici-x' };
  };

  const cellsOf = (block: Block): Point[] => {
    if (block.orientation === 'stojici') return [{ x: block.x, y: block.y }];
    if (block.orientation === 'lezici-x') {
      return [{ x: block.x, y: block.y }, { x: block.x + 1, y: block.y }];
    }
    return [{ x: block.x, y: block.y }, { x: block.x, y: block.y + 1 }];
  };

  /** Vyhodnotí, co se stane po dosednutí kostky na nové místo. */
  const settle = (): void => {
    const cells = cellsOf(state.block);
    const standing = state.block.orientation === 'stojici';

    // Cíl: spadnout do díry nastojato. Naležato se přes ni jen přejde.
    if (standing && tileAt(cells[0]!.x, cells[0]!.y) === 'cil') {
      state.solved = true;
      state.fallTicks = FALL_TICKS;
      return;
    }

    // Pád mimo dlaždice. Přes cíl se naležato jen přejde — je to díra
    // v podlaze, do které se kostka nastojato propadne, ale naležato ji přemostí.
    if (cells.some((c) => !solid(c.x, c.y))) {
      state.lost = true;
      state.fallTicks = FALL_TICKS;
      return;
    }

    // Křehká dlaždice praskne jen pod stojící kostkou — ta na ni tlačí celou vahou.
    if (standing) {
      const i = index(cells[0]!.x, cells[0]!.y);
      if (state.tiles[i] === 'krehka') {
        state.broken[i] = true;
        state.lost = true;
        state.fallTicks = FALL_TICKS;
        return;
      }
    }

    // Spínač stačí přejet čímkoliv.
    if (cells.some((c) => tileAt(c.x, c.y) === 'spinac')) toggleBridges();
  };

  const move = (direction: Dir): boolean => {
    if (state.solved || state.lost || state.won || state.fallTicks > 0) return false;
    state.block = rolled(direction);
    state.moves++;
    state.totalMoves++;
    settle();
    return true;
  };

  /**
   * Úroveň se postaví znovu. `totalMoves` se nemaže — odehrané tahy se
   * počítají dál, restart je cena za chybu, ne návrat na začátek skóre.
   */
  const restartLevel = (): void => {
    loadLevel(state.level);
  };

  loadLevel(startLevel);

  return {
    state,
    rulesVersion: KOSTKA_RULES_VERSION,
    levels: LEVELS,
    index,
    tileAt,
    blockCells,
    move,
    restartLevel,
    loadLevel,

    step(mask) {
      const previous = state.previousMask;
      state.previousMask = mask;
      if (state.won) return;
      state.tick++;

      if (state.fallTicks > 0) {
        if (--state.fallTicks > 0) return;
        if (state.solved) {
          if (state.level + 1 >= LEVELS.length) {
            state.won = true;
            return;
          }
          loadLevel(state.level + 1);
          return;
        }
        if (state.lost) {
          restartLevel();
          return;
        }
      }

      if (justPressed(mask, previous, BIT.left)) move('left');
      else if (justPressed(mask, previous, BIT.right)) move('right');
      else if (justPressed(mask, previous, BIT.up)) move('up');
      else if (justPressed(mask, previous, BIT.down)) move('down');
      else if (justPressed(mask, previous, BIT.b)) restartLevel();
    },
  };
}
