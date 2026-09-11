/**
 * Pexeso — otáčení dvojic.
 *
 * Model počítá s víc hráči, protože stejná pravidla obsluhují singleplayer
 * na čas, dva hráče u jednoho zařízení i online partii (F3).
 */

import { createRng, type Rng } from '@vevit-games/engine/core';

export const PEXESO_RULES_VERSION = 1;

/** Motivy jsou vlastní vektorové ilustrace, identifikované jménem sady. */
export type MotifSet = 'zvirata' | 'ovoce' | 'doprava' | 'vesmir';

export const MOTIFS: Record<MotifSet, string[]> = {
  zvirata: ['jezek', 'liska', 'sova', 'bobr', 'rys', 'vydra', 'los', 'zajic',
    'datel', 'kamzik', 'krtek', 'capek', 'tchor', 'sokol', 'strakapoud', 'kuna'],
  ovoce: ['jablko', 'hruska', 'svestka', 'tresne', 'jahoda', 'malina', 'boruvka', 'rybiz',
    'meruňka', 'broskev', 'hrozen', 'angrest', 'ostruzina', 'brusinka', 'visne', 'kdoule'],
  doprava: ['tramvaj', 'vlak', 'autobus', 'kolo', 'lod', 'letadlo', 'metro', 'trolejbus',
    'nakladak', 'traktor', 'motorka', 'lanovka', 'sanitka', 'hasici', 'bagr', 'kombajn'],
  vesmir: ['raketa', 'planeta', 'kometa', 'hvezda', 'mesic', 'satelit', 'cerna-dira', 'mlhovina',
    'asteroid', 'skafandr', 'sonda', 'dalekohled', 'galaxie', 'meteor', 'prstenec', 'stanice'],
};

export interface PexesoCard {
  id: number;
  motif: string;
  /** Právě otočená lícem nahoru. */
  flipped: boolean;
  /** Už nalezená dvojice; zůstává vidět. */
  matched: boolean;
  /** Kdo dvojici našel — pro rozdělení bodů. */
  owner: number | null;
}

export interface PexesoConfig {
  /** Sudé číslo; mřížka je rows × cols. */
  rows: number;
  cols: number;
  motifs: MotifSet;
  players: number;
  /** Kolik kroků logiky zůstanou neshodné karty otočené. */
  peekTicks: number;
}

export interface PexesoState {
  cards: PexesoCard[];
  /** Indexy právě otočených karet (nejvýš dva). */
  revealed: number[];
  currentPlayer: number;
  scores: number[];
  moves: number;
  tick: number;
  /** Odpočet, než se neshodná dvojice zase otočí. */
  peekTimer: number;
  over: boolean;
}

export interface PexesoGame {
  readonly state: PexesoState;
  readonly config: PexesoConfig;
  readonly rulesVersion: number;
  tick(): void;
  /** Otočí kartu. Vrací `false`, když tah nejde provést. */
  flip(index: number): boolean;
  elapsedMs(): number;
  /** Vítěz u víc hráčů; `null` při remíze nebo nedohrané hře. */
  winner(): number | null;
}

const DEFAULT_CONFIG: PexesoConfig = {
  rows: 4, cols: 4, motifs: 'zvirata', players: 1, peekTicks: 55,
};

export function createPexeso(seed: string, config: Partial<PexesoConfig> = {}): PexesoGame {
  const cfg: PexesoConfig = { ...DEFAULT_CONFIG, ...config };
  const total = cfg.rows * cfg.cols;
  if (total % 2 !== 0) throw new Error('Pexeso potřebuje sudý počet karet.');

  const rng: Rng = createRng(seed);
  const pairs = total / 2;
  const pool = MOTIFS[cfg.motifs];
  // Když je dvojic víc než motivů, motivy se opakují s pořadovým číslem.
  const chosen = Array.from({ length: pairs }, (_, i) => {
    const motif = pool[i % pool.length]!;
    return i < pool.length ? motif : `${motif}-${Math.floor(i / pool.length) + 1}`;
  });

  const deck = rng.shuffle([...chosen, ...chosen]);
  const state: PexesoState = {
    cards: deck.map((motif, id) => ({ id, motif, flipped: false, matched: false, owner: null })),
    revealed: [],
    currentPlayer: 0,
    scores: Array<number>(cfg.players).fill(0),
    moves: 0,
    tick: 0,
    peekTimer: 0,
    over: false,
  };

  const hideRevealed = (): void => {
    for (const index of state.revealed) {
      const card = state.cards[index];
      if (card && !card.matched) card.flipped = false;
    }
    state.revealed = [];
    state.peekTimer = 0;
  };

  return {
    state,
    config: cfg,
    rulesVersion: PEXESO_RULES_VERSION,

    tick() {
      if (state.over) return;
      state.tick++;
      if (state.peekTimer > 0 && --state.peekTimer === 0) {
        hideRevealed();
        // Neúspěšný tah předává slovo dalšímu hráči.
        state.currentPlayer = (state.currentPlayer + 1) % cfg.players;
      }
    },

    flip(index) {
      if (state.over) return false;
      const card = state.cards[index];
      if (!card || card.matched || card.flipped) return false;

      // Kliknutí během prohlížení neshodné dvojice ji rovnou zavře —
      // hráč nemusí čekat na odpočet.
      if (state.peekTimer > 0) {
        hideRevealed();
        state.currentPlayer = (state.currentPlayer + 1) % cfg.players;
      }
      if (state.revealed.length >= 2) return false;

      card.flipped = true;
      state.revealed.push(index);
      if (state.revealed.length < 2) return true;

      state.moves++;
      const [a, b] = state.revealed as [number, number];
      const first = state.cards[a]!;
      const second = state.cards[b]!;

      if (first.motif === second.motif) {
        first.matched = true;
        second.matched = true;
        first.owner = state.currentPlayer;
        second.owner = state.currentPlayer;
        state.scores[state.currentPlayer] = (state.scores[state.currentPlayer] ?? 0) + 1;
        state.revealed = [];
        // Úspěšný tah znamená hrát znovu.
        if (state.cards.every((c) => c.matched)) state.over = true;
      } else {
        state.peekTimer = cfg.peekTicks;
      }
      return true;
    },

    elapsedMs: () => Math.round((state.tick * 1000) / 60),

    winner() {
      if (!state.over || cfg.players < 2) return null;
      const best = Math.max(...state.scores);
      const leaders = state.scores.filter((s) => s === best);
      return leaders.length === 1 ? state.scores.indexOf(best) : null;
    },
  };
}
