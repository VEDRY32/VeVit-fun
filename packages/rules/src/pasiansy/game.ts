/**
 * Pasiánsy — tři varianty v jedné hře.
 *
 * Sdílejí model „hromádky a tahy mezi nimi"; liší se pravidly pokládání
 * a rozdáním. Díky společnému modelu má tap-to-move, undo i automatické
 * dokončení jednu implementaci pro všechny tři.
 */

import { createRng, type Rng } from '@vevit-games/engine/core';
import {
  buildDeck, alternatesColor, SUITS,
  type Card, type Suit, type Rank,
} from './cards.js';

export const PASIANSY_RULES_VERSION = 1;

export type Variant = 'klondike' | 'pavouk' | 'freecell';

export type PileKind =
  | 'zasoba'    // lízací balíček
  | 'odkladani' // odkryté karty ze zásoby
  | 'cil'       // cílové hromádky (esa nahoru)
  | 'sloupec'   // hlavní sloupce
  | 'volne';    // volná místa (FreeCell)

export interface Pile {
  id: string;
  kind: PileKind;
  cards: Card[];
}

export interface Move {
  from: string;
  to: string;
  /** Kolik karet od konce hromádky se přesouvá. */
  count: number;
}

export interface PasiansyConfig {
  variant: Variant;
  /** Klondike: kolik karet se lízne najednou (1 nebo 3). */
  drawCount: 1 | 3;
  /** Pavouk: kolik barev je ve hře (1, 2 nebo 4). */
  spiderSuits: 1 | 2 | 4;
}

export interface PasiansyState {
  piles: Record<string, Pile>;
  moves: number;
  score: number;
  ticks: number;
  won: boolean;
  /** Historie pro neomezené vrácení tahu. */
  history: { piles: Record<string, Card[]>; moves: number; score: number }[];
  /** Kolikrát se protočila zásoba — Klondike to počítá do skóre. */
  recycles: number;
}

export interface PasiansyGame {
  readonly state: PasiansyState;
  readonly config: PasiansyConfig;
  readonly rulesVersion: number;
  tick(): void;
  /** Lízne ze zásoby, případně ji protočí. */
  draw(): boolean;
  canMove(move: Move): boolean;
  applyMove(move: Move): boolean;
  /** Nejlepší tah pro danou kartu — obsluha tapnutí. */
  autoMove(pileId: string, cardIndex: number): boolean;
  undo(): boolean;
  /** Pošle nahoru vše, co jde. Vrací počet přesunutých karet. */
  autoFinish(): number;
  /** Nápověda: první nalezený smysluplný tah. */
  hint(): Move | null;
  elapsedMs(): number;
}

const DEFAULT_CONFIG: PasiansyConfig = { variant: 'klondike', drawCount: 1, spiderSuits: 4 };

const topOf = (pile: Pile): Card | undefined => pile.cards[pile.cards.length - 1];

export function createPasiansy(seed: string, config: Partial<PasiansyConfig> = {}): PasiansyGame {
  const cfg: PasiansyConfig = { ...DEFAULT_CONFIG, ...config };
  const rng: Rng = createRng(seed);

  const piles: Record<string, Pile> = {};
  const addPile = (id: string, kind: PileKind): void => {
    piles[id] = { id, kind, cards: [] };
  };

  const columnCount = cfg.variant === 'pavouk' ? 10 : 8;
  const columnIds: string[] = [];
  for (let i = 0; i < (cfg.variant === 'klondike' ? 7 : columnCount); i++) {
    const id = `sloupec${i}`;
    addPile(id, 'sloupec');
    columnIds.push(id);
  }

  const foundationIds: string[] = [];
  const foundationCount = cfg.variant === 'pavouk' ? 8 : 4;
  for (let i = 0; i < foundationCount; i++) {
    const id = `cil${i}`;
    addPile(id, 'cil');
    foundationIds.push(id);
  }

  const freeIds: string[] = [];
  if (cfg.variant === 'freecell') {
    for (let i = 0; i < 4; i++) {
      const id = `volne${i}`;
      addPile(id, 'volne');
      freeIds.push(id);
    }
  }

  if (cfg.variant !== 'freecell') {
    addPile('zasoba', 'zasoba');
    addPile('odkladani', 'odkladani');
  }

  const state: PasiansyState = {
    piles,
    moves: 0,
    score: 0,
    ticks: 0,
    won: false,
    history: [],
    recycles: 0,
  };

  // --- Rozdání ---------------------------------------------------------------

  const deal = (): void => {
    const spiderSuits: readonly Suit[] = SUITS.slice(0, cfg.spiderSuits);
    const deck = rng.shuffle(
      cfg.variant === 'pavouk' ? buildDeck(2, spiderSuits) : buildDeck(1),
    ).map((card) => ({ ...card }));

    let index = 0;
    const take = (): Card => deck[index++]!;

    if (cfg.variant === 'klondike') {
      for (let column = 0; column < 7; column++) {
        for (let row = 0; row <= column; row++) {
          const card = take();
          card.faceUp = row === column;
          piles[`sloupec${column}`]!.cards.push(card);
        }
      }
      while (index < deck.length) piles.zasoba!.cards.push(take());
      return;
    }

    if (cfg.variant === 'freecell') {
      // Všechny karty lícem nahoru; hra je čistě o plánování.
      for (let i = 0; i < deck.length; i++) {
        const card = take();
        card.faceUp = true;
        piles[`sloupec${i % 8}`]!.cards.push(card);
      }
      return;
    }

    // Pavouk: 54 karet do sloupců, zbytek do zásoby po deseti.
    for (let i = 0; i < 54; i++) {
      const card = take();
      const column = i % 10;
      card.faceUp = i >= 44;
      piles[`sloupec${column}`]!.cards.push(card);
    }
    while (index < deck.length) piles.zasoba!.cards.push(take());
  };

  deal();

  // --- Pravidla pokládání ----------------------------------------------------

  /** Je posloupnost karet od `index` přenositelná jako celek? */
  const isMovableSequence = (pile: Pile, index: number): boolean => {
    const cards = pile.cards.slice(index);
    if (cards.length === 0) return false;
    if (!cards[0]!.faceUp) return false;
    if (cards.length === 1) return true;

    for (let i = 1; i < cards.length; i++) {
      const prev = cards[i - 1]!;
      const current = cards[i]!;
      if (!current.faceUp) return false;
      if (current.rank !== prev.rank - 1) return false;
      if (cfg.variant === 'pavouk') {
        // Pavouk přesouvá jen posloupnost v jedné barvě.
        if (current.suit !== prev.suit) return false;
      } else if (!alternatesColor(prev.suit, current.suit)) {
        return false;
      }
    }
    return true;
  };

  /**
   * FreeCell: kolik karet lze přesunout naráz.
   * (volná místa + 1) × 2^(prázdné sloupce) — klasické pravidlo pro
   * „supermove", který se dá poskládat z jednotlivých tahů.
   */
  const maxFreecellMove = (targetEmpty: boolean): number => {
    const freeCells = freeIds.filter((id) => piles[id]!.cards.length === 0).length;
    let emptyColumns = columnIds.filter((id) => piles[id]!.cards.length === 0).length;
    if (targetEmpty && emptyColumns > 0) emptyColumns--;
    return (freeCells + 1) * 2 ** emptyColumns;
  };

  const canPlaceOnColumn = (card: Card, target: Pile): boolean => {
    const top = topOf(target);
    if (!top) {
      // Prázdný sloupec: Klondike jen krále, ostatní cokoliv.
      return cfg.variant !== 'klondike' || card.rank === 13;
    }
    if (!top.faceUp) return false;
    if (card.rank !== top.rank - 1) return false;
    if (cfg.variant === 'pavouk') return true; // Pavouk pokládá bez ohledu na barvu
    return alternatesColor(top.suit, card.suit);
  };

  const canPlaceOnFoundation = (cards: Card[], target: Pile): boolean => {
    if (cfg.variant === 'pavouk') {
      // Pavouk odkládá jen hotovou řadu od krále po eso v jedné barvě.
      if (cards.length !== 13 || target.cards.length > 0) return false;
      return cards[0]!.rank === 13 && cards.every((c, i) => c.rank === 13 - i && c.suit === cards[0]!.suit);
    }
    if (cards.length !== 1) return false;
    const card = cards[0]!;
    const top = topOf(target);
    if (!top) return card.rank === 1;
    return top.suit === card.suit && card.rank === top.rank + 1;
  };

  const snapshot = (): void => {
    state.history.push({
      piles: Object.fromEntries(
        Object.entries(piles).map(([id, pile]) => [id, pile.cards.map((c) => ({ ...c }))]),
      ),
      moves: state.moves,
      score: state.score,
    });
    // Historie je neomezená, ale ne nekonečná — 500 tahů zpět stačí komukoliv.
    if (state.history.length > 500) state.history.shift();
  };

  const checkWin = (): void => {
    const total = cfg.variant === 'pavouk' ? 104 : 52;
    const collected = foundationIds.reduce((sum, id) => sum + piles[id]!.cards.length, 0);
    if (collected >= total) state.won = true;
  };

  const revealTop = (pile: Pile): void => {
    const top = topOf(pile);
    if (top && !top.faceUp) {
      top.faceUp = true;
      state.score += 5;
    }
  };

  const game: PasiansyGame = {
    state,
    config: cfg,
    rulesVersion: PASIANSY_RULES_VERSION,

    tick() {
      if (!state.won) state.ticks++;
    },

    draw() {
      const stock = piles.zasoba;
      const waste = piles.odkladani;
      if (!stock) return false;

      if (cfg.variant === 'pavouk') {
        if (stock.cards.length === 0) return false;
        // Pavouk rozdá po jedné do každého sloupce — a jen když žádný není prázdný.
        if (columnIds.some((id) => piles[id]!.cards.length === 0)) return false;
        snapshot();
        for (const id of columnIds) {
          const card = stock.cards.pop();
          if (!card) break;
          card.faceUp = true;
          piles[id]!.cards.push(card);
        }
        state.moves++;
        return true;
      }

      if (!waste) return false;
      snapshot();

      if (stock.cards.length === 0) {
        if (waste.cards.length === 0) return false;
        // Protočení zásoby; u lízání po jedné to stojí body.
        stock.cards = waste.cards.reverse().map((card) => ({ ...card, faceUp: false }));
        waste.cards = [];
        state.recycles++;
        if (cfg.drawCount === 1) state.score = Math.max(0, state.score - 100);
        return true;
      }

      for (let i = 0; i < cfg.drawCount && stock.cards.length > 0; i++) {
        const card = stock.cards.pop()!;
        card.faceUp = true;
        waste.cards.push(card);
      }
      state.moves++;
      return true;
    },

    canMove(move) {
      const from = piles[move.from];
      const to = piles[move.to];
      if (!from || !to || from === to) return false;
      if (move.count <= 0 || move.count > from.cards.length) return false;

      const index = from.cards.length - move.count;
      const cards = from.cards.slice(index);

      // Ze zásoby se netahá a z odkládání jde jen vrchní karta.
      if (from.kind === 'zasoba') return false;
      if (from.kind === 'odkladani' && move.count !== 1) return false;
      if (from.kind === 'cil' && cfg.variant === 'pavouk') return false;
      if (!isMovableSequence(from, index)) return false;

      if (to.kind === 'cil') return canPlaceOnFoundation(cards, to);
      if (to.kind === 'volne') return move.count === 1 && to.cards.length === 0;
      if (to.kind === 'sloupec') {
        if (cfg.variant === 'freecell' && move.count > maxFreecellMove(to.cards.length === 0)) {
          return false;
        }
        return canPlaceOnColumn(cards[0]!, to);
      }
      return false;
    },

    applyMove(move) {
      if (!game.canMove(move)) return false;
      snapshot();

      const from = piles[move.from]!;
      const to = piles[move.to]!;
      const cards = from.cards.splice(from.cards.length - move.count, move.count);
      to.cards.push(...cards);

      state.moves++;
      if (to.kind === 'cil') state.score += 10;
      if (from.kind === 'sloupec') revealTop(from);

      // Pavouk: hotová řada od krále po eso odchází na cíl sama.
      if (cfg.variant === 'pavouk' && to.kind === 'sloupec' && to.cards.length >= 13) {
        const tail = to.cards.slice(-13);
        const free = foundationIds.find((id) => piles[id]!.cards.length === 0);
        if (free && canPlaceOnFoundation(tail, piles[free]!)) {
          piles[free]!.cards.push(...to.cards.splice(to.cards.length - 13, 13));
          state.score += 100;
          revealTop(to);
        }
      }

      checkWin();
      return true;
    },

    autoMove(pileId, cardIndex) {
      const pile = piles[pileId];
      if (!pile) return false;
      const count = pile.cards.length - cardIndex;
      if (count <= 0) return false;

      // Nejdřív na cíl, pak na sloupec s kartou, teprve nakonec na prázdný
      // sloupec nebo volné místo — jinak by tap zbytečně vyprazdňoval sloupce.
      const targets = [
        ...foundationIds,
        ...columnIds.filter((id) => id !== pileId && piles[id]!.cards.length > 0),
        ...columnIds.filter((id) => id !== pileId && piles[id]!.cards.length === 0),
        ...freeIds,
      ];
      for (const target of targets) {
        if (game.applyMove({ from: pileId, to: target, count })) return true;
      }
      return false;
    },

    undo() {
      const previous = state.history.pop();
      if (!previous) return false;
      for (const [id, cards] of Object.entries(previous.piles)) {
        piles[id]!.cards = cards.map((c) => ({ ...c }));
      }
      state.moves = previous.moves;
      state.score = previous.score;
      state.won = false;
      return true;
    },

    autoFinish() {
      let moved = 0;
      let progress = true;
      while (progress) {
        progress = false;
        for (const source of [...columnIds, ...freeIds, 'odkladani']) {
          if (!piles[source]) continue;
          for (const target of foundationIds) {
            if (game.applyMove({ from: source, to: target, count: 1 })) {
              moved++;
              progress = true;
              break;
            }
          }
        }
      }
      return moved;
    },

    hint() {
      const sources = [...columnIds, ...freeIds, 'odkladani'].filter((id) => piles[id]);
      for (const from of sources) {
        const pile = piles[from]!;
        for (let index = 0; index < pile.cards.length; index++) {
          if (!pile.cards[index]!.faceUp) continue;
          const count = pile.cards.length - index;
          for (const to of [...foundationIds, ...columnIds]) {
            if (to === from) continue;
            // Přesun celého sloupce na prázdný sloupec nic nepřináší.
            if (piles[to]!.cards.length === 0 && index === 0 && pile.kind === 'sloupec') continue;
            if (game.canMove({ from, to, count })) return { from, to, count };
          }
        }
      }
      return null;
    },

    elapsedMs: () => Math.round((state.ticks * 1000) / 60),
  };

  return game;
}

export { buildDeck };
