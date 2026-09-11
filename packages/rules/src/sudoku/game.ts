/**
 * Sudoku — hratelný stav nad generátorem.
 *
 * Poznámky tužkou, undo/redo, zvýraznění konfliktů a nápověda, která
 * vysvětlí použitou techniku (zadání 7.6).
 */

import { createRng, type Rng } from '@vevit-games/engine/core';
import {
  generatePuzzle, nextStep, peersOf, isValidPlacement,
  SIZE, CELLS, type Grid, type Difficulty, type Puzzle,
} from './solver.js';

export const SUDOKU_RULES_VERSION = 1;

export interface SudokuState {
  puzzle: Grid;
  solution: Grid;
  /** Čísla zapsaná hráčem; 0 = prázdno. Zadaná čísla jsou v `puzzle`. */
  entries: Int8Array;
  /** Poznámky tužkou: bitová maska 1..9 na buňku. */
  notes: Int16Array;
  selected: number;
  noteMode: boolean;
  /** Čísla, která hráč zapsal špatně — zvýraznění jde vypnout. */
  showConflicts: boolean;
  hintsUsed: number;
  ticks: number;
  moves: number;
  solved: boolean;
  difficulty: Difficulty;
}

export interface SudokuGame {
  readonly state: SudokuState;
  readonly rulesVersion: number;
  tick(): void;
  isGiven(index: number): boolean;
  valueAt(index: number): number;
  select(index: number): void;
  /** Zapíše číslo, nebo přepne poznámku podle režimu. */
  enter(value: number): boolean;
  clear(): void;
  toggleNoteMode(): void;
  /** Doplní poznámky ze všech kandidátů. */
  fillNotes(): void;
  undo(): boolean;
  redo(): boolean;
  /** Nápověda: doplní další krok a vysvětlí ho. */
  hint(): { index: number; value: number; reason: string } | null;
  /** Buňky, které jsou v konfliktu s jinou stejnou hodnotou. */
  conflicts(): Set<number>;
  elapsedMs(): number;
}

interface HistoryEntry {
  index: number;
  previousValue: number;
  previousNotes: number;
  value: number;
  notes: number;
}

export function createSudoku(seed: string, difficulty: Difficulty = 'stredni'): SudokuGame {
  const rng: Rng = createRng(seed);
  const generated: Puzzle = generatePuzzle(rng, difficulty);

  const state: SudokuState = {
    puzzle: generated.puzzle,
    solution: generated.solution,
    entries: new Int8Array(CELLS),
    notes: new Int16Array(CELLS),
    selected: 0,
    noteMode: false,
    showConflicts: true,
    hintsUsed: 0,
    ticks: 0,
    moves: 0,
    solved: false,
    difficulty,
  };

  const history: HistoryEntry[] = [];
  let historyIndex = 0;

  const isGiven = (index: number): boolean => state.puzzle[index] !== 0;
  const valueAt = (index: number): number =>
    isGiven(index) ? state.puzzle[index]! : state.entries[index]!;

  const currentGrid = (): Grid => {
    const grid = new Int8Array(CELLS);
    for (let index = 0; index < CELLS; index++) grid[index] = valueAt(index);
    return grid;
  };

  const checkSolved = (): void => {
    for (let index = 0; index < CELLS; index++) {
      if (valueAt(index) !== state.solution[index]) return;
    }
    state.solved = true;
  };

  const record = (entry: HistoryEntry): void => {
    // Nový tah zahodí větev, do které se hráč vrátil krokem zpět.
    history.length = historyIndex;
    history.push(entry);
    historyIndex = history.length;
  };

  const apply = (index: number, value: number, notes: number): void => {
    state.entries[index] = value;
    state.notes[index] = notes;
  };

  return {
    state,
    rulesVersion: SUDOKU_RULES_VERSION,
    isGiven,
    valueAt,

    tick() {
      if (!state.solved) state.ticks++;
    },

    select(index) {
      if (index < 0 || index >= CELLS) return;
      state.selected = index;
    },

    enter(value) {
      const index = state.selected;
      if (state.solved || isGiven(index)) return false;
      if (value < 1 || value > SIZE) return false;

      const previousValue = state.entries[index]!;
      const previousNotes = state.notes[index]!;

      if (state.noteMode) {
        // Poznámka se přepíná; zapsané číslo poznámky nahradí.
        const bit = 1 << (value - 1);
        const nextNotes = previousNotes ^ bit;
        apply(index, 0, nextNotes);
        record({ index, previousValue, previousNotes, value: 0, notes: nextNotes });
      } else {
        // Stejné číslo podruhé buňku vymaže — rychlejší než mazací tlačítko.
        const nextValue = previousValue === value ? 0 : value;
        apply(index, nextValue, 0);
        record({ index, previousValue, previousNotes, value: nextValue, notes: 0 });

        // Zapsané číslo zmizí z poznámek sousedů; ruční mazání by zdržovalo.
        if (nextValue !== 0) {
          const bit = 1 << (nextValue - 1);
          for (const peer of peersOf(index)) {
            if (state.notes[peer]! & bit) state.notes[peer]! &= ~bit;
          }
        }
      }

      state.moves++;
      checkSolved();
      return true;
    },

    clear() {
      const index = state.selected;
      if (state.solved || isGiven(index)) return;
      const previousValue = state.entries[index]!;
      const previousNotes = state.notes[index]!;
      if (previousValue === 0 && previousNotes === 0) return;
      apply(index, 0, 0);
      record({ index, previousValue, previousNotes, value: 0, notes: 0 });
      state.moves++;
    },

    toggleNoteMode() {
      state.noteMode = !state.noteMode;
    },

    fillNotes() {
      const grid = currentGrid();
      for (let index = 0; index < CELLS; index++) {
        if (isGiven(index) || state.entries[index] !== 0) continue;
        let mask = 0;
        for (let value = 1; value <= SIZE; value++) {
          if (isValidPlacement(grid, index, value)) mask |= 1 << (value - 1);
        }
        state.notes[index] = mask;
      }
    },

    undo() {
      if (historyIndex === 0) return false;
      historyIndex--;
      const entry = history[historyIndex]!;
      apply(entry.index, entry.previousValue, entry.previousNotes);
      state.solved = false;
      checkSolved();
      return true;
    },

    redo() {
      if (historyIndex >= history.length) return false;
      const entry = history[historyIndex]!;
      historyIndex++;
      apply(entry.index, entry.value, entry.notes);
      checkSolved();
      return true;
    },

    hint() {
      if (state.solved) return null;
      const grid = currentGrid();

      // Nejdřív opravíme špatně zapsané číslo — bez toho by nápověda radila
      // do rozbité mřížky.
      for (let index = 0; index < CELLS; index++) {
        if (isGiven(index) || state.entries[index] === 0) continue;
        if (state.entries[index] !== state.solution[index]) {
          state.hintsUsed++;
          return {
            index,
            value: state.solution[index]!,
            reason: 'Tohle číslo tu být nemůže. Správně je jiné.',
          };
        }
      }

      const step = nextStep(grid);
      if (!step) return null;
      state.hintsUsed++;
      return { index: step.index, value: step.value, reason: step.reason };
    },

    conflicts() {
      const out = new Set<number>();
      if (!state.showConflicts) return out;

      for (let index = 0; index < CELLS; index++) {
        const value = valueAt(index);
        if (value === 0) continue;
        for (const peer of peersOf(index)) {
          if (valueAt(peer) === value) {
            out.add(index);
            out.add(peer);
          }
        }
      }
      return out;
    },

    elapsedMs: () => Math.round((state.ticks * 1000) / 60),
  };
}

export { generatePuzzle, type Difficulty, type Puzzle };
