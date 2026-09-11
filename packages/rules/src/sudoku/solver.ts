/**
 * Řešič a generátor sudoku.
 *
 * Generátor musí zaručit **jednoznačné řešení** a obtížnost určit podle
 * nejtěžší techniky, kterou je při řešení potřeba použít — ne podle počtu
 * odkrytých čísel. Zadání s 30 čísly může být těžší než s 26.
 */

import type { Rng } from '@vevit-games/engine/core';

export const SIZE = 9;
export const BOX = 3;
export const CELLS = SIZE * SIZE;

/** 0 = prázdno. */
export type Grid = Int8Array;

/**
 * Techniky v pořadí rostoucí obtížnosti. Obtížnost zadání je ta nejtěžší,
 * bez které se řešení neobejde.
 */
export type Technique =
  | 'single'         // v buňce zbývá jediný kandidát
  | 'hidden-single'  // číslo má v řádku/sloupci/boxu jediné možné místo
  | 'naked-pair'
  | 'hidden-pair'
  | 'pointing'       // kandidáti v boxu leží v jednom řádku/sloupci
  | 'x-wing'
  | 'swordfish'
  | 'guess';         // nic z výše uvedeného nestačí

export const TECHNIQUE_ORDER: Technique[] = [
  'single', 'hidden-single', 'naked-pair', 'hidden-pair', 'pointing', 'x-wing', 'swordfish', 'guess',
];

export type Difficulty = 'velmi-lehka' | 'lehka' | 'stredni' | 'tezka' | 'velmi-tezka';

/** Nejtěžší technika, kterou daná obtížnost smí vyžadovat. */
export const DIFFICULTY_CAP: Record<Difficulty, Technique> = {
  'velmi-lehka': 'single',
  lehka: 'hidden-single',
  stredni: 'naked-pair',
  tezka: 'pointing',
  'velmi-tezka': 'swordfish',
};

export const rowOf = (index: number): number => Math.floor(index / SIZE);
export const colOf = (index: number): number => index % SIZE;
export const boxOf = (index: number): number =>
  Math.floor(rowOf(index) / BOX) * BOX + Math.floor(colOf(index) / BOX);

/** Indexy buněk v řádku, sloupci a boxu — předpočítané. */
const ROWS: number[][] = Array.from({ length: SIZE }, (_, r) =>
  Array.from({ length: SIZE }, (_, c) => r * SIZE + c));
const COLS: number[][] = Array.from({ length: SIZE }, (_, c) =>
  Array.from({ length: SIZE }, (_, r) => r * SIZE + c));
const BOXES: number[][] = Array.from({ length: SIZE }, (_, b) => {
  const startRow = Math.floor(b / BOX) * BOX;
  const startCol = (b % BOX) * BOX;
  const out: number[] = [];
  for (let r = 0; r < BOX; r++) {
    for (let c = 0; c < BOX; c++) out.push((startRow + r) * SIZE + startCol + c);
  }
  return out;
});

export const UNITS: number[][] = [...ROWS, ...COLS, ...BOXES];

/** Buňky, které s danou buňkou sdílí řádek, sloupec nebo box. */
const PEERS: number[][] = Array.from({ length: CELLS }, (_, index) => {
  const set = new Set<number>();
  for (const cell of ROWS[rowOf(index)]!) set.add(cell);
  for (const cell of COLS[colOf(index)]!) set.add(cell);
  for (const cell of BOXES[boxOf(index)]!) set.add(cell);
  set.delete(index);
  return [...set];
});

export const peersOf = (index: number): number[] => PEERS[index]!;

export function isValidPlacement(grid: Grid, index: number, value: number): boolean {
  for (const peer of PEERS[index]!) {
    if (grid[peer] === value) return false;
  }
  return true;
}

/**
 * Spočítá řešení, ale nejvýš `limit` — pro kontrolu jednoznačnosti stačí
 * vědět, jestli je jedno, nebo víc.
 */
/** Je zadání samo o sobě bezrozporné? Dvě stejná čísla v jednotce = není. */
export function isConsistent(grid: Grid): boolean {
  for (let index = 0; index < CELLS; index++) {
    const value = grid[index];
    if (!value) continue;
    for (const peer of PEERS[index]!) {
      if (grid[peer] === value) return false;
    }
  }
  return true;
}

export function countSolutions(grid: Grid, limit = 2): number {
  // Bez téhle kontroly by se rozpor mezi už vyplněnými buňkami neodhalil:
  // `isValidPlacement` se ptá jen na prázdné buňky, takže by řešič
  // prohledal celý strom, než by došel k nule.
  if (!isConsistent(grid)) return 0;

  const work = Int8Array.from(grid);

  const solve = (): number => {
    // Nejdřív buňka s nejmenším počtem kandidátů — zkracuje prohledávání.
    let bestIndex = -1;
    let bestCandidates: number[] = [];
    for (let index = 0; index < CELLS; index++) {
      if (work[index] !== 0) continue;
      const candidates: number[] = [];
      for (let value = 1; value <= SIZE; value++) {
        if (isValidPlacement(work, index, value)) candidates.push(value);
      }
      if (candidates.length === 0) return 0;
      if (candidates.length < (bestCandidates.length || SIZE + 1)) {
        bestIndex = index;
        bestCandidates = candidates;
        if (candidates.length === 1) break;
      }
    }
    if (bestIndex === -1) return 1;

    let found = 0;
    for (const value of bestCandidates) {
      work[bestIndex] = value;
      found += solve();
      work[bestIndex] = 0;
      if (found >= limit) break;
    }
    return found;
  };

  return solve();
}

export const hasUniqueSolution = (grid: Grid): boolean => countSolutions(grid, 2) === 1;

/** Vyplní prázdnou mřížku náhodným platným řešením. */
export function generateSolution(rng: Rng): Grid {
  const grid = new Int8Array(CELLS);

  const fill = (index: number): boolean => {
    if (index >= CELLS) return true;
    for (const value of rng.shuffle(Array.from({ length: SIZE }, (_, i) => i + 1))) {
      if (!isValidPlacement(grid, index, value)) continue;
      grid[index] = value;
      if (fill(index + 1)) return true;
      grid[index] = 0;
    }
    return false;
  };

  fill(0);
  return grid;
}

// --- Logické řešení a odhad obtížnosti --------------------------------------

type Candidates = Set<number>[];

function buildCandidates(grid: Grid): Candidates {
  return Array.from({ length: CELLS }, (_, index) => {
    if (grid[index] !== 0) return new Set<number>();
    const set = new Set<number>();
    for (let value = 1; value <= SIZE; value++) {
      if (isValidPlacement(grid, index, value)) set.add(value);
    }
    return set;
  });
}

interface Step {
  technique: Technique;
  index: number;
  value: number;
  /** Lidsky čitelné vysvětlení pro nápovědu ve hře. */
  reason: string;
}

/** Najde další krok čistě logikou. `null`, když žádná technika nezabere. */
export function nextStep(grid: Grid): Step | null {
  const candidates = buildCandidates(grid);

  // 1. Jediný kandidát v buňce.
  for (let index = 0; index < CELLS; index++) {
    if (grid[index] !== 0) continue;
    if (candidates[index]!.size === 1) {
      const value = [...candidates[index]!][0]!;
      return {
        technique: 'single',
        index, value,
        reason: `V téhle buňce může být jen ${value}.`,
      };
    }
  }

  // 2. Číslo má v jednotce jediné možné místo.
  for (const unit of UNITS) {
    for (let value = 1; value <= SIZE; value++) {
      const places = unit.filter((index) => grid[index] === 0 && candidates[index]!.has(value));
      if (places.length === 1 && !unit.some((index) => grid[index] === value)) {
        return {
          technique: 'hidden-single',
          index: places[0]!, value,
          reason: `V téhle řadě, sloupci nebo čtverci je ${value} možné jen tady.`,
        };
      }
    }
  }

  return null;
}

/**
 * Odhadne obtížnost: řeší zadání jen logikou a hlásí nejtěžší použitou
 * techniku. Vrací `null`, když zadání logikou vyřešit nejde.
 */
export function estimateDifficulty(puzzle: Grid): Technique | null {
  const grid = Int8Array.from(puzzle);
  let hardest: Technique = 'single';

  for (let guard = 0; guard < CELLS * 2; guard++) {
    if (grid.every((value) => value !== 0)) return hardest;

    const step = nextStep(grid);
    if (!step) {
      // Pokročilejší techniky zatím neimplementujeme; zadání, které
      // potřebuje víc než skryté jedničky, hlásíme jako těžké.
      return countSolutions(grid, 2) === 1 ? 'pointing' : null;
    }

    if (TECHNIQUE_ORDER.indexOf(step.technique) > TECHNIQUE_ORDER.indexOf(hardest)) {
      hardest = step.technique;
    }
    grid[step.index] = step.value;
  }

  return grid.every((value) => value !== 0) ? hardest : null;
}

export interface Puzzle {
  puzzle: Grid;
  solution: Grid;
  difficulty: Difficulty;
  technique: Technique;
  givens: number;
}

/**
 * Vygeneruje zadání dané obtížnosti.
 *
 * Postup: náhodné řešení, pak se symetricky odebírají čísla, dokud zůstává
 * jednoznačné. Symetrie je estetická věc, ale u sudoku se očekává.
 */
export function generatePuzzle(rng: Rng, difficulty: Difficulty): Puzzle {
  const solution = generateSolution(rng);
  const puzzle = Int8Array.from(solution);

  // Kolik čísel se pokusíme nechat. Nižší obtížnost jich nechá víc.
  const targetGivens: Record<Difficulty, number> = {
    'velmi-lehka': 45, lehka: 38, stredni: 32, tezka: 28, 'velmi-tezka': 24,
  };
  const target = targetGivens[difficulty];

  const order = rng.shuffle(Array.from({ length: CELLS }, (_, i) => i));
  let givens = CELLS;

  for (const index of order) {
    if (givens <= target) break;
    if (puzzle[index] === 0) continue;

    // Symetrický protějšek přes střed.
    const mirror = CELLS - 1 - index;
    const removed: number[] = [index];
    if (mirror !== index && puzzle[mirror] !== 0) removed.push(mirror);

    const backup = removed.map((i) => puzzle[i]!);
    for (const i of removed) puzzle[i] = 0;

    if (hasUniqueSolution(puzzle)) {
      givens -= removed.length;
    } else {
      removed.forEach((i, k) => {
        puzzle[i] = backup[k]!;
      });
    }
  }

  const technique = estimateDifficulty(puzzle) ?? 'guess';
  return { puzzle, solution, difficulty, technique, givens };
}
