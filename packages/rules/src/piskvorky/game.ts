/**
 * Piškvorky — pět v řadě na neomezené ploše.
 *
 * AI nepočítá minimax přes celou desku (ta je nekonečná), ale hledá hrozby:
 * ohodnotí každé volné pole v okolí už zahraných tahů podle toho, jaké
 * řady by tam vznikly pro oba hráče. Je to rychlé a hraje to lidsky.
 */

import { createRng, type Rng } from '@vevit-games/engine/core';

export const PISKVORKY_RULES_VERSION = 1;

export const WIN_LENGTH = 5;
/** Jak daleko od zahraných tahů se hledají kandidáti. */
const SEARCH_RADIUS = 2;

export type Mark = 'x' | 'o';
export type Difficulty = 'lehka' | 'stredni' | 'tezka';

export interface Move {
  x: number;
  y: number;
  mark: Mark;
}

export interface PiskvorkyState {
  /** Řídké pole: klíč `x,y`. Deska je neomezená. */
  board: Map<string, Mark>;
  current: Mark;
  moves: Move[];
  winner: Mark | null;
  winningLine: { x: number; y: number }[];
  /** Remíza jen v omezeném režimu, když je deska plná. */
  draw: boolean;
  /** Omezení plochy; `null` = neomezená. */
  bounds: { width: number; height: number } | null;
}

export interface PiskvorkyGame {
  readonly state: PiskvorkyState;
  readonly rulesVersion: number;
  markAt(x: number, y: number): Mark | null;
  place(x: number, y: number): boolean;
  aiMove(difficulty: Difficulty): { x: number; y: number } | null;
  undo(): boolean;
  reset(): void;
}

const key = (x: number, y: number): string => `${x},${y}`;

const DIRECTIONS = [
  [1, 0], [0, 1], [1, 1], [1, -1],
] as const;

/**
 * Ohodnocení řady: čtyřka s volným koncem je prakticky výhra, otevřená
 * trojka je vážná hrozba. Uzavřené řady (obě strany blokované) neplatí.
 */
function lineScore(length: number, openEnds: number): number {
  if (length >= WIN_LENGTH) return 1_000_000;
  if (openEnds === 0) return 0;
  const table: Record<number, [number, number]> = {
    // délka: [jeden volný konec, dva volné konce]
    4: [12_000, 120_000],
    3: [700, 9_000],
    2: [60, 400],
    1: [4, 12],
  };
  const entry = table[length];
  if (!entry) return 0;
  return openEnds === 2 ? entry[1] : entry[0];
}

export function createPiskvorky(
  seed: string,
  bounds: { width: number; height: number } | null = null,
): PiskvorkyGame {
  const rng: Rng = createRng(seed);

  const state: PiskvorkyState = {
    board: new Map(),
    current: 'x',
    moves: [],
    winner: null,
    winningLine: [],
    draw: false,
    bounds,
  };

  const inBounds = (x: number, y: number): boolean => {
    if (!state.bounds) return true;
    const halfW = Math.floor(state.bounds.width / 2);
    const halfH = Math.floor(state.bounds.height / 2);
    return x >= -halfW && x <= halfW && y >= -halfH && y <= halfH;
  };

  const markAt = (x: number, y: number): Mark | null => state.board.get(key(x, y)) ?? null;

  /** Najde vítěznou pětici procházející daným polem. */
  const findWin = (x: number, y: number): { x: number; y: number }[] | null => {
    const mark = markAt(x, y);
    if (!mark) return null;

    for (const [dx, dy] of DIRECTIONS) {
      const line = [{ x, y }];
      for (const sign of [1, -1] as const) {
        let cx = x + dx * sign;
        let cy = y + dy * sign;
        while (markAt(cx, cy) === mark) {
          line.push({ x: cx, y: cy });
          cx += dx * sign;
          cy += dy * sign;
        }
      }
      if (line.length >= WIN_LENGTH) {
        // Seřadíme podél směru, ať jde čára vykreslit.
        return line
          .sort((a, b) => (a.x - b.x) || (a.y - b.y))
          .slice(0, Math.max(WIN_LENGTH, line.length));
      }
    }
    return null;
  };

  /** Volná pole blízko už zahraných tahů. Prázdná deska → střed. */
  const candidates = (): { x: number; y: number }[] => {
    if (state.moves.length === 0) return [{ x: 0, y: 0 }];

    const seen = new Set<string>();
    const out: { x: number; y: number }[] = [];
    for (const move of state.moves) {
      for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy++) {
        for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
          const x = move.x + dx;
          const y = move.y + dy;
          const k = key(x, y);
          if (seen.has(k) || state.board.has(k) || !inBounds(x, y)) continue;
          seen.add(k);
          out.push({ x, y });
        }
      }
    }
    return out;
  };

  /**
   * Kolik by dané pole přineslo danému hráči.
   * Sečte hodnotu řad ve všech čtyřech směrech.
   */
  const scoreFor = (x: number, y: number, mark: Mark): number => {
    let total = 0;
    for (const [dx, dy] of DIRECTIONS) {
      let length = 1;
      let openEnds = 0;

      for (const sign of [1, -1] as const) {
        let cx = x + dx * sign;
        let cy = y + dy * sign;
        while (markAt(cx, cy) === mark) {
          length++;
          cx += dx * sign;
          cy += dy * sign;
        }
        // Konec je volný, jen když tam není soupeř ani okraj.
        if (markAt(cx, cy) === null && inBounds(cx, cy)) openEnds++;
      }
      total += lineScore(length, openEnds);
    }
    return total;
  };

  const game: PiskvorkyGame = {
    state,
    rulesVersion: PISKVORKY_RULES_VERSION,
    markAt,

    place(x, y) {
      if (state.winner || state.draw) return false;
      if (!inBounds(x, y) || state.board.has(key(x, y))) return false;

      state.board.set(key(x, y), state.current);
      state.moves.push({ x, y, mark: state.current });

      const win = findWin(x, y);
      if (win) {
        state.winner = state.current;
        state.winningLine = win;
        return true;
      }

      if (state.bounds && state.board.size >= state.bounds.width * state.bounds.height) {
        state.draw = true;
        return true;
      }

      state.current = state.current === 'x' ? 'o' : 'x';
      return true;
    },

    aiMove(difficulty) {
      const options = candidates();
      if (options.length === 0) return null;

      const me = state.current;
      const other: Mark = me === 'x' ? 'o' : 'x';

      // Vlastní výhra má vždycky přednost před blokem. Bez téhle kontroly
      // by váha obrany mohla přebít dokončení vlastní pětice a AI by
      // místo výhry bránila — což testy odhalily.
      for (const option of options) {
        if (scoreFor(option.x, option.y, me) >= 1_000_000) {
          return { x: option.x, y: option.y };
        }
      }

      // Útok i obrana: vlastní hodnota pole plus váha toho, co bychom
      // soupeři sebrali. Vyšší obtížnost si obrany víc všímá.
      const defenceWeight = { lehka: 0.6, stredni: 0.95, tezka: 1.15 }[difficulty];

      const scored = options.map((option) => ({
        ...option,
        score: scoreFor(option.x, option.y, me) + scoreFor(option.x, option.y, other) * defenceWeight,
      }));
      scored.sort((a, b) => b.score - a.score);

      const bestScore = scored[0]!.score;
      // Nutnou obranu nezahodí ani lehká obtížnost.
      if (bestScore >= 100_000) return { x: scored[0]!.x, y: scored[0]!.y };

      const window = { lehka: 8, stredni: 3, tezka: 1 }[difficulty];
      const pool = scored.slice(0, Math.max(1, Math.min(window, scored.length)));
      const pick = pool[rng.int(0, pool.length)]!;
      return { x: pick.x, y: pick.y };
    },

    undo() {
      const last = state.moves.pop();
      if (!last) return false;
      state.board.delete(key(last.x, last.y));
      state.current = last.mark;
      state.winner = null;
      state.winningLine = [];
      state.draw = false;
      return true;
    },

    reset() {
      state.board.clear();
      state.moves = [];
      state.current = 'x';
      state.winner = null;
      state.winningLine = [];
      state.draw = false;
    },
  };

  return game;
}
