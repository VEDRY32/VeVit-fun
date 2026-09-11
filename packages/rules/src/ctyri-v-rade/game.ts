/**
 * Čtyři v řadě — 7×6, gravitace, minimax s alfa-beta ořezáváním.
 *
 * AI je čistá funkce nad stavem, takže ji jde otestovat bez vykreslování
 * a v F3 použít i na serveru pro doplnění prázdných míst boty.
 */

import { createRng, type Rng } from '@vevit-games/engine/core';

export const CTYRI_RULES_VERSION = 1;

/**
 * Rozměry nesou předponu hry, protože `CTYRI_COLS`/`CTYRI_ROWS` už patří Kostkopádu
 * a sdílený barrel `@vevit-games/rules` by je nedokázal rozlišit.
 */
export const CTYRI_COLS = 7;
export const CTYRI_ROWS = 6;
export const WIN_LENGTH = 4;

/** 0 = prázdno, 1 = první hráč, 2 = druhý hráč. */
export type CtyriCell = 0 | 1 | 2;
export type CtyriPlayer = 1 | 2;

export type Difficulty = 'lehka' | 'stredni' | 'tezka';

/** Hloubka prohledávání podle obtížnosti. */
const DEPTH: Record<Difficulty, number> = { lehka: 2, stredni: 5, tezka: 7 };
/** Jak často lehká obtížnost zahraje schválně slabší tah. */
const BLUNDER_CHANCE: Record<Difficulty, number> = { lehka: 0.35, stredni: 0.08, tezka: 0 };

export interface CtyriState {
  /** Sloupcově orientované pole: `board[col][row]`, row 0 je dole. */
  board: CtyriCell[][];
  current: CtyriPlayer;
  moves: number;
  winner: CtyriPlayer | null;
  /** Vítězná čtveřice pro zvýraznění. */
  winningCells: { col: number; row: number }[];
  draw: boolean;
  lastMove: { col: number; row: number } | null;
}

export interface CtyriGame {
  readonly state: CtyriState;
  readonly rulesVersion: number;
  /** Vhodí žeton do sloupce. Vrací řádek, kam dopadl, nebo -1. */
  drop(col: number): number;
  legalMoves(): number[];
  /** Tah, který by zahrála AI dané obtížnosti. */
  aiMove(difficulty: Difficulty): number;
  undo(): boolean;
  reset(): void;
}

const emptyBoard = (): CtyriCell[][] =>
  Array.from({ length: CTYRI_COLS }, () => Array<CtyriCell>(CTYRI_ROWS).fill(0));

/** Nejvyšší obsazený řádek ve sloupci; CTYRI_ROWS = plný sloupec. */
const heightOf = (board: CtyriCell[][], col: number): number => {
  const column = board[col]!;
  let height = 0;
  while (height < CTYRI_ROWS && column[height] !== 0) height++;
  return height;
};

const DIRECTIONS = [
  [0, 1],   // svisle
  [1, 0],   // vodorovně
  [1, 1],   // úhlopříčka nahoru
  [1, -1],  // úhlopříčka dolů
] as const;

/** Najde vítěznou čtveřici procházející daným polem. */
function findWin(board: CtyriCell[][], col: number, row: number): { col: number; row: number }[] | null {
  const player = board[col]![row]!;
  if (player === 0) return null;

  for (const [dc, dr] of DIRECTIONS) {
    const line = [{ col, row }];
    // Oba směry od položeného žetonu.
    for (const sign of [1, -1] as const) {
      let c = col + dc * sign;
      let r = row + dr * sign;
      while (c >= 0 && c < CTYRI_COLS && r >= 0 && r < CTYRI_ROWS && board[c]![r] === player) {
        line.push({ col: c, row: r });
        c += dc * sign;
        r += dr * sign;
      }
    }
    if (line.length >= WIN_LENGTH) return line.slice(0, Math.max(WIN_LENGTH, line.length));
  }
  return null;
}

/**
 * Hodnocení pozice.
 *
 * Součet přes všechna okna čtyř polí: vlastní trojice s volným polem je
 * skoro výhra, soupeřova trojice je skoro prohra a proto váží víc.
 */
function evaluate(board: CtyriCell[][], me: CtyriPlayer): number {
  const other: CtyriPlayer = me === 1 ? 2 : 1;
  let score = 0;

  // Střední sloupec dává nejvíc možností, jak čtveřici dokončit.
  const center = Math.floor(CTYRI_COLS / 2);
  for (let row = 0; row < CTYRI_ROWS; row++) {
    if (board[center]![row] === me) score += 6;
    else if (board[center]![row] === other) score -= 6;
  }

  const windowScore = (cells: CtyriCell[]): number => {
    const mine = cells.filter((c) => c === me).length;
    const theirs = cells.filter((c) => c === other).length;
    const empty = cells.filter((c) => c === 0).length;
    if (mine > 0 && theirs > 0) return 0;
    if (mine === 3 && empty === 1) return 60;
    if (mine === 2 && empty === 2) return 12;
    if (theirs === 3 && empty === 1) return -80;
    if (theirs === 2 && empty === 2) return -14;
    return 0;
  };

  for (let col = 0; col < CTYRI_COLS; col++) {
    for (let row = 0; row < CTYRI_ROWS; row++) {
      for (const [dc, dr] of DIRECTIONS) {
        const endCol = col + dc * (WIN_LENGTH - 1);
        const endRow = row + dr * (WIN_LENGTH - 1);
        if (endCol < 0 || endCol >= CTYRI_COLS || endRow < 0 || endRow >= CTYRI_ROWS) continue;
        const cells: CtyriCell[] = [];
        for (let i = 0; i < WIN_LENGTH; i++) cells.push(board[col + dc * i]![row + dr * i]!);
        score += windowScore(cells);
      }
    }
  }
  return score;
}

const isFull = (board: CtyriCell[][]): boolean =>
  board.every((column) => column[CTYRI_ROWS - 1] !== 0);

/** Pořadí sloupců od středu ven — lepší tahy první, alfa-beta ořeže víc. */
const SEARCH_ORDER = [3, 2, 4, 1, 5, 0, 6];

function minimax(
  board: CtyriCell[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  me: CtyriPlayer,
): { score: number; col: number } {
  const other: CtyriPlayer = me === 1 ? 2 : 1;
  const player = maximizing ? me : other;

  const moves = SEARCH_ORDER.filter((col) => heightOf(board, col) < CTYRI_ROWS);
  if (moves.length === 0) return { score: 0, col: -1 };

  // Okamžitá výhra nebo prohra se hledá dřív, než se jde do hloubky.
  for (const col of moves) {
    const row = heightOf(board, col);
    board[col]![row] = player;
    const win = findWin(board, col, row);
    board[col]![row] = 0;
    if (win) {
      // Bližší výhra je lepší než vzdálená — proto se odečítá hloubka.
      return { score: maximizing ? 100_000 + depth : -100_000 - depth, col };
    }
  }

  if (depth === 0) return { score: evaluate(board, me), col: moves[0]! };

  let best = maximizing ? -Infinity : Infinity;
  let bestCol = moves[0]!;

  for (const col of moves) {
    const row = heightOf(board, col);
    board[col]![row] = player;
    const { score } = minimax(board, depth - 1, alpha, beta, !maximizing, me);
    board[col]![row] = 0;

    if (maximizing) {
      if (score > best) {
        best = score;
        bestCol = col;
      }
      alpha = Math.max(alpha, best);
    } else {
      if (score < best) {
        best = score;
        bestCol = col;
      }
      beta = Math.min(beta, best);
    }
    if (alpha >= beta) break;
  }

  return { score: best, col: bestCol };
}

export function createCtyriVRade(seed: string): CtyriGame {
  const rng: Rng = createRng(seed);
  const history: { col: number; row: number; player: CtyriPlayer }[] = [];

  const state: CtyriState = {
    board: emptyBoard(),
    current: 1,
    moves: 0,
    winner: null,
    winningCells: [],
    draw: false,
    lastMove: null,
  };

  const game: CtyriGame = {
    state,
    rulesVersion: CTYRI_RULES_VERSION,

    drop(col) {
      if (state.winner || state.draw) return -1;
      if (col < 0 || col >= CTYRI_COLS) return -1;
      const row = heightOf(state.board, col);
      if (row >= CTYRI_ROWS) return -1;

      state.board[col]![row] = state.current;
      history.push({ col, row, player: state.current });
      state.lastMove = { col, row };
      state.moves++;

      const win = findWin(state.board, col, row);
      if (win) {
        state.winner = state.current;
        state.winningCells = win;
      } else if (isFull(state.board)) {
        state.draw = true;
      } else {
        state.current = state.current === 1 ? 2 : 1;
      }
      return row;
    },

    legalMoves: () =>
      Array.from({ length: CTYRI_COLS }, (_, col) => col).filter((col) => heightOf(state.board, col) < CTYRI_ROWS),

    aiMove(difficulty) {
      const moves = game.legalMoves();
      if (moves.length === 0) return -1;

      // Lehká obtížnost občas zahraje náhodně — ale nikdy nezahodí
      // okamžitou výhru ani nepřehlédne okamžitou prohru.
      if (rng.chance(BLUNDER_CHANCE[difficulty])) {
        const immediate = minimax(state.board, 0, -Infinity, Infinity, true, state.current);
        if (Math.abs(immediate.score) < 100_000) return rng.pick(moves);
      }

      return minimax(state.board, DEPTH[difficulty], -Infinity, Infinity, true, state.current).col;
    },

    undo() {
      const last = history.pop();
      if (!last) return false;
      state.board[last.col]![last.row] = 0;
      state.current = last.player;
      state.winner = null;
      state.winningCells = [];
      state.draw = false;
      state.moves--;
      const previous = history[history.length - 1];
      state.lastMove = previous ? { col: previous.col, row: previous.row } : null;
      return true;
    },

    reset() {
      state.board = emptyBoard();
      state.current = 1;
      state.moves = 0;
      state.winner = null;
      state.winningCells = [];
      state.draw = false;
      state.lastMove = null;
      history.length = 0;
    },
  };

  return game;
}
