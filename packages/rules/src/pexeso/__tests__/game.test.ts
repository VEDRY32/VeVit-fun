import { describe, it, expect } from 'vitest';
import { createPexeso, MOTIFS, type PexesoGame } from '../game.js';

/** Najde index druhé karty se stejným motivem. */
function partnerOf(game: PexesoGame, index: number): number {
  const motif = game.state.cards[index]!.motif;
  return game.state.cards.findIndex((c, i) => i !== index && c.motif === motif);
}

/** Najde dvě karty s různým motivem. */
function mismatchedPair(game: PexesoGame): [number, number] {
  const first = 0;
  const second = game.state.cards.findIndex(
    (c, i) => i !== first && c.motif !== game.state.cards[first]!.motif,
  );
  return [first, second];
}

describe('Pexeso', () => {
  it('každý motiv je na desce právě dvakrát', () => {
    const game = createPexeso('dvojice', { rows: 4, cols: 4 });
    const counts = new Map<string, number>();
    for (const card of game.state.cards) {
      counts.set(card.motif, (counts.get(card.motif) ?? 0) + 1);
    }
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
    expect(game.state.cards).toHaveLength(16);
  });

  it('lichý počet karet neprojde', () => {
    expect(() => createPexeso('liche', { rows: 3, cols: 3 })).toThrow(/sudý/);
  });

  it('zvládne i největší mřížku 8×8', () => {
    const game = createPexeso('velka', { rows: 8, cols: 8 });
    expect(game.state.cards).toHaveLength(64);
    const counts = new Map<string, number>();
    for (const card of game.state.cards) counts.set(card.motif, (counts.get(card.motif) ?? 0) + 1);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
  });

  it('stejný seed dá stejné rozložení', () => {
    const a = createPexeso('stejne', { rows: 4, cols: 4 });
    const b = createPexeso('stejne', { rows: 4, cols: 4 });
    expect(a.state.cards.map((c) => c.motif)).toEqual(b.state.cards.map((c) => c.motif));
  });

  it('shodná dvojice zůstane odkrytá a přičte bod', () => {
    const game = createPexeso('shoda', { rows: 4, cols: 4 });
    const partner = partnerOf(game, 0);
    game.flip(0);
    game.flip(partner);
    expect(game.state.cards[0]!.matched).toBe(true);
    expect(game.state.cards[partner]!.matched).toBe(true);
    expect(game.state.scores[0]).toBe(1);
    expect(game.state.revealed).toHaveLength(0);
  });

  it('neshodná dvojice se po odpočtu otočí zpátky', () => {
    const game = createPexeso('neshoda', { rows: 4, cols: 4, peekTicks: 5 });
    const [a, b] = mismatchedPair(game);
    game.flip(a);
    game.flip(b);
    expect(game.state.cards[a]!.flipped).toBe(true);

    for (let i = 0; i < 6; i++) game.tick();
    expect(game.state.cards[a]!.flipped).toBe(false);
    expect(game.state.cards[b]!.flipped).toBe(false);
  });

  it('kliknutí během prohlížení dvojici hned zavře', () => {
    const game = createPexeso('rychlik', { rows: 4, cols: 4, peekTicks: 60 });
    const [a, b] = mismatchedPair(game);
    game.flip(a);
    game.flip(b);
    const third = game.state.cards.findIndex((c, i) => i !== a && i !== b);
    game.flip(third);
    expect(game.state.cards[a]!.flipped).toBe(false);
    expect(game.state.cards[third]!.flipped).toBe(true);
  });

  it('už otočenou ani nalezenou kartu nejde otočit znovu', () => {
    const game = createPexeso('opakovani', { rows: 4, cols: 4 });
    const partner = partnerOf(game, 0);
    game.flip(0);
    expect(game.flip(0)).toBe(false);
    game.flip(partner);
    expect(game.flip(0)).toBe(false);
  });

  it('neplatný index se odmítne', () => {
    const game = createPexeso('index', { rows: 4, cols: 4 });
    expect(game.flip(-1)).toBe(false);
    expect(game.flip(999)).toBe(false);
  });

  it('u dvou hráčů se po neúspěchu předá tah', () => {
    const game = createPexeso('stridani', { rows: 4, cols: 4, players: 2, peekTicks: 3 });
    const [a, b] = mismatchedPair(game);
    expect(game.state.currentPlayer).toBe(0);
    game.flip(a);
    game.flip(b);
    for (let i = 0; i < 4; i++) game.tick();
    expect(game.state.currentPlayer).toBe(1);
  });

  it('po úspěchu hráč hraje znovu', () => {
    const game = createPexeso('znovu', { rows: 4, cols: 4, players: 2 });
    const partner = partnerOf(game, 0);
    game.flip(0);
    game.flip(partner);
    expect(game.state.currentPlayer).toBe(0);
  });

  it('nalezení všech dvojic hru ukončí', () => {
    const game = createPexeso('konec', { rows: 4, cols: 4 });
    while (!game.state.over) {
      const index = game.state.cards.findIndex((c) => !c.matched);
      game.flip(index);
      game.flip(partnerOf(game, index));
    }
    expect(game.state.over).toBe(true);
    expect(game.state.cards.every((c) => c.matched)).toBe(true);
  });

  it('vítěz se určí jen u víc hráčů a jen po konci', () => {
    const solo = createPexeso('solo', { rows: 4, cols: 4 });
    expect(solo.winner()).toBeNull();

    const duo = createPexeso('duo', { rows: 4, cols: 4, players: 2 });
    expect(duo.winner()).toBeNull();
    duo.state.over = true;
    duo.state.scores = [5, 3];
    expect(duo.winner()).toBe(0);
    duo.state.scores = [4, 4];
    expect(duo.winner()).toBeNull();
  });

  it('čas běží po ticích a po konci se zastaví', () => {
    const game = createPexeso('cas', { rows: 4, cols: 4 });
    for (let i = 0; i < 60; i++) game.tick();
    expect(game.elapsedMs()).toBe(1000);
    game.state.over = true;
    for (let i = 0; i < 60; i++) game.tick();
    expect(game.elapsedMs()).toBe(1000);
  });

  it('každá sada motivů má dost položek pro mřížku 8×8', () => {
    for (const motifs of Object.values(MOTIFS)) {
      expect(motifs.length).toBeGreaterThanOrEqual(16);
      expect(new Set(motifs).size).toBe(motifs.length);
    }
  });
});
