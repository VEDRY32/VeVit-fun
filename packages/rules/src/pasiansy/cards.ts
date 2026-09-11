/** Karty a balíček. Vlastní design, velké čitelné indexy pro mobil. */

export const SUITS = ['srdce', 'kary', 'kriz', 'piky'] as const;
export type Suit = (typeof SUITS)[number];

/** 1 = eso, 11 = spodek, 12 = svršek, 13 = král. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export interface Card {
  /** Stabilní identita pro animace: barva a hodnota nestačí u více balíčků. */
  id: number;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export const isRed = (suit: Suit): boolean => suit === 'srdce' || suit === 'kary';

/** Střídání barev: v hlavních sloupcích se pokládá jen na opačnou barvu. */
export const alternatesColor = (a: Suit, b: Suit): boolean => isRed(a) !== isRed(b);

export const SUIT_SYMBOLS: Record<Suit, string> = {
  srdce: '♥', kary: '♦', kriz: '♣', piky: '♠',
};

export const RANK_LABELS: Record<Rank, string> = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
};

/** Vytvoří `decks` balíčků; `suits` omezí barvy (Pavouk hraje na 1, 2 nebo 4). */
export function buildDeck(decks = 1, suits: readonly Suit[] = SUITS): Card[] {
  const cards: Card[] = [];
  let id = 0;
  const perSuit = Math.ceil((decks * 52) / (suits.length * 13));
  for (let copy = 0; copy < perSuit; copy++) {
    for (const suit of suits) {
      for (const rank of RANKS) {
        cards.push({ id: id++, suit, rank, faceUp: false });
      }
    }
  }
  return cards.slice(0, decks * 52);
}
