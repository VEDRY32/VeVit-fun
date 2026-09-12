/**
 * Hledač min.
 *
 * První kliknutí je vždy bezpečné včetně okolí — miny se rozmisťují až po něm.
 * Režim „bez hádání" navíc generuje pole tak dlouho, dokud ho řešič nedokáže
 * dohrát čistou logikou, takže hráč nikdy nemusí tipovat.
 */

import { createRng, type Rng } from '@vevit-games/engine/core';

export const HLEDAC_RULES_VERSION = 2;

/** `wrongFlag` vzniká až po prohře: vlajka, pod kterou mina nebyla. */
export type CellState = 'hidden' | 'revealed' | 'flagged' | 'question' | 'wrongFlag';
export type HledacDifficulty = 'zacatecnik' | 'pokrocily' | 'expert' | 'vlastni';

export interface HledacConfig {
  width: number;
  height: number;
  mines: number;
  /** Generuje jen pole řešitelná bez hádání. */
  noGuessing: boolean;
  /** Povolí otazník jako třetí stav pravého kliknutí. */
  questionMarks: boolean;
}

export const DIFFICULTIES: Record<Exclude<HledacDifficulty, 'vlastni'>, Omit<HledacConfig, 'noGuessing' | 'questionMarks'>> = {
  zacatecnik: { width: 9, height: 9, mines: 10 },
  pokrocily: { width: 16, height: 16, mines: 40 },
  expert: { width: 30, height: 16, mines: 99 },
};

export interface HledacState {
  /** `true` = mina. Prázdné, dokud hráč neodkryje první pole. */
  mines: boolean[];
  /** Počet min v okolí; -1 u miny. */
  counts: Int8Array;
  cells: CellState[];
  started: boolean;
  over: boolean;
  won: boolean;
  /** Pole, na kterém hra skončila — vykreslí se zvýrazněně. */
  explodedAt: number | null;
  flagsUsed: number;
  revealedCount: number;
  /** Herní čas v krocích logiky; měří se od prvního odkrytí. */
  ticks: number;
}

export interface HledacGame {
  readonly state: HledacState;
  readonly config: HledacConfig;
  readonly rulesVersion: number;
  tick(): void;
  reveal(x: number, y: number): void;
  toggleFlag(x: number, y: number): void;
  /** Klik na číslo s odpovídajícím počtem vlajek odkryje zbytek okolí. */
  chord(x: number, y: number): void;
  index(x: number, y: number): number;
  neighbours(index: number): number[];
  /** Čas v milisekundách — skóre režimu se hodnotí časem. */
  elapsedMs(): number;
}

export function createHledacMin(seed: string, config: Partial<HledacConfig> = {}): HledacGame {
  const cfg: HledacConfig = {
    ...DIFFICULTIES.zacatecnik,
    noGuessing: false,
    questionMarks: false,
    ...config,
  };
  const total = cfg.width * cfg.height;
  // Musí zbýt aspoň devět bezpečných polí na první klik a jeho okolí.
  cfg.mines = Math.min(cfg.mines, total - 9);
  const rng: Rng = createRng(seed);

  const state: HledacState = {
    mines: Array<boolean>(total).fill(false),
    counts: new Int8Array(total),
    cells: Array<CellState>(total).fill('hidden'),
    started: false,
    over: false,
    won: false,
    explodedAt: null,
    flagsUsed: 0,
    revealedCount: 0,
    ticks: 0,
  };

  const index = (x: number, y: number): number => y * cfg.width + x;

  const neighbours = (i: number): number[] => {
    const x = i % cfg.width;
    const y = (i / cfg.width) | 0;
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cfg.width || ny >= cfg.height) continue;
        out.push(index(nx, ny));
      }
    }
    return out;
  };

  const computeCounts = (mines: boolean[]): Int8Array => {
    const counts = new Int8Array(total);
    for (let i = 0; i < total; i++) {
      if (mines[i]) {
        counts[i] = -1;
        continue;
      }
      counts[i] = neighbours(i).filter((n) => mines[n]).length;
    }
    return counts;
  };

  const layMines = (safeIndex: number): boolean[] => {
    const forbidden = new Set([safeIndex, ...neighbours(safeIndex)]);
    const candidates: number[] = [];
    for (let i = 0; i < total; i++) if (!forbidden.has(i)) candidates.push(i);
    const chosen = rng.shuffle(candidates).slice(0, cfg.mines);
    const mines = Array<boolean>(total).fill(false);
    for (const i of chosen) mines[i] = true;
    return mines;
  };

  /**
   * Zkusí pole dohrát jen odvozením (dvě základní pravidla plus omezené
   * porovnání sousedních čísel). Vrací `true`, když hádání není potřeba.
   */
  const solvableWithoutGuessing = (mines: boolean[], counts: Int8Array, firstIndex: number): boolean => {
    const revealed = new Set<number>();
    const flagged = new Set<number>();

    const floodFrom = (start: number): void => {
      const stack = [start];
      while (stack.length > 0) {
        const i = stack.pop()!;
        if (revealed.has(i) || flagged.has(i)) continue;
        revealed.add(i);
        if (counts[i] === 0) stack.push(...neighbours(i));
      }
    };
    floodFrom(firstIndex);

    let progress = true;
    while (progress) {
      progress = false;
      for (const i of revealed) {
        const count = counts[i]!;
        if (count <= 0) continue;
        const hidden = neighbours(i).filter((n) => !revealed.has(n) && !flagged.has(n));
        const flags = neighbours(i).filter((n) => flagged.has(n)).length;
        if (hidden.length === 0) continue;

        // Všechna zbylá skrytá pole jsou miny.
        if (count - flags === hidden.length) {
          for (const n of hidden) flagged.add(n);
          progress = true;
          continue;
        }
        // Všechny miny už jsou označené → zbytek je bezpečný.
        if (count === flags) {
          for (const n of hidden) floodFrom(n);
          progress = true;
        }
      }
    }

    return revealed.size === total - cfg.mines;
  };

  const start = (firstIndex: number): void => {
    let mines = layMines(firstIndex);
    let counts = computeCounts(mines);

    if (cfg.noGuessing) {
      // Po dvou stech pokusech to vzdáme a vezmeme poslední pole — lepší než
      // nechat hráče čekat na generátor, který pro dané zadání nemá řešení.
      for (let attempt = 0; attempt < 200; attempt++) {
        if (solvableWithoutGuessing(mines, counts, firstIndex)) break;
        mines = layMines(firstIndex);
        counts = computeCounts(mines);
      }
    }

    state.mines = mines;
    state.counts = counts;
    state.started = true;
  };

  const checkWin = (): void => {
    if (state.revealedCount === total - cfg.mines) {
      state.won = true;
      state.over = true;
    }
  };

  const revealAt = (i: number): void => {
    if (state.over) return;
    if (state.cells[i] !== 'hidden' && state.cells[i] !== 'question') return;

    if (!state.started) start(i);

    if (state.mines[i]) {
      state.cells[i] = 'revealed';
      state.explodedAt = i;
      state.over = true;
      // Po prohře se ukáže celé pole: kde miny byly a které vlajky byly
      // vedle. Bez toho hráč netuší, kde udělal chybu.
      for (let m = 0; m < total; m++) {
        if (m === i) continue;
        if (state.mines[m]) {
          if (state.cells[m] === 'hidden' || state.cells[m] === 'question') state.cells[m] = 'revealed';
        } else if (state.cells[m] === 'flagged') {
          state.cells[m] = 'wrongFlag';
        }
      }
      return;
    }

    // Prázdná pole se rozlévají dál; zásobník místo rekurze kvůli hloubce.
    const stack = [i];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const cell = state.cells[current];
      if (cell === 'revealed' || cell === 'flagged') continue;
      state.cells[current] = 'revealed';
      state.revealedCount++;
      if (state.counts[current] === 0) stack.push(...neighbours(current));
    }
    checkWin();
  };

  return {
    state,
    config: cfg,
    rulesVersion: HLEDAC_RULES_VERSION,
    index,
    neighbours,

    tick() {
      if (state.started && !state.over) state.ticks++;
    },

    reveal(x, y) {
      if (x < 0 || y < 0 || x >= cfg.width || y >= cfg.height) return;
      revealAt(index(x, y));
    },

    toggleFlag(x, y) {
      if (state.over) return;
      const i = index(x, y);
      const cell = state.cells[i];
      if (cell === 'revealed') return;
      if (cell === 'hidden') {
        state.cells[i] = 'flagged';
        state.flagsUsed++;
      } else if (cell === 'flagged') {
        state.cells[i] = cfg.questionMarks ? 'question' : 'hidden';
        state.flagsUsed--;
      } else {
        state.cells[i] = 'hidden';
      }
    },

    chord(x, y) {
      if (state.over) return;
      const i = index(x, y);
      if (state.cells[i] !== 'revealed') return;
      const count = state.counts[i]!;
      if (count <= 0) return;
      const around = neighbours(i);
      const flags = around.filter((n) => state.cells[n] === 'flagged').length;
      if (flags !== count) return;
      for (const n of around) revealAt(n);
    },

    elapsedMs: () => Math.round((state.ticks * 1000) / 60),
  };
}
