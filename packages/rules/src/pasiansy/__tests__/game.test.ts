import { describe, it, expect } from 'vitest';
import { createPasiansy, type PasiansyGame, type Variant } from '../game.js';
import { buildDeck, SUITS, isRed, alternatesColor, type Card } from '../cards.js';

const countCards = (game: PasiansyGame): number =>
  Object.values(game.state.piles).reduce((sum, pile) => sum + pile.cards.length, 0);

/** Nahradí obsah hromádky konkrétními kartami — pro cílené testy pravidel. */
function setPile(game: PasiansyGame, id: string, cards: Partial<Card>[]): void {
  game.state.piles[id]!.cards = cards.map((c, i) => ({
    id: 900 + i, suit: 'piky', rank: 1, faceUp: true, ...c,
  })) as Card[];
}

describe('balíček', () => {
  it('jeden balíček má 52 karet a každou právě jednou', () => {
    const deck = buildDeck(1);
    expect(deck).toHaveLength(52);
    const keys = new Set(deck.map((c) => `${c.suit}${c.rank}`));
    expect(keys.size).toBe(52);
  });

  it('dva balíčky mají 104 karet', () => {
    expect(buildDeck(2)).toHaveLength(104);
  });

  it('omezení na jednu barvu vytvoří jen tu barvu', () => {
    const deck = buildDeck(2, ['piky']);
    expect(deck).toHaveLength(104);
    expect(deck.every((c) => c.suit === 'piky')).toBe(true);
  });

  it('červené a černé barvy se rozlišují správně', () => {
    expect(isRed('srdce')).toBe(true);
    expect(isRed('kary')).toBe(true);
    expect(isRed('piky')).toBe(false);
    expect(alternatesColor('srdce', 'piky')).toBe(true);
    expect(alternatesColor('srdce', 'kary')).toBe(false);
  });
});

describe.each<Variant>(['klondike', 'pavouk', 'freecell'])('rozdání — %s', (variant) => {
  it('rozdá správný počet karet a žádnou neztratí', () => {
    const game = createPasiansy(`rozdani-${variant}`, { variant });
    expect(countCards(game)).toBe(variant === 'pavouk' ? 104 : 52);
  });

  it('stejný seed dá stejné rozdání', () => {
    const a = createPasiansy('stejne', { variant });
    const b = createPasiansy('stejne', { variant });
    for (const id of Object.keys(a.state.piles)) {
      expect(a.state.piles[id]!.cards.map((c) => `${c.suit}${c.rank}`))
        .toEqual(b.state.piles[id]!.cards.map((c) => `${c.suit}${c.rank}`));
    }
  });

  it('žádná karta se nerozdá dvakrát', () => {
    const game = createPasiansy(`unikat-${variant}`, { variant });
    const ids = Object.values(game.state.piles).flatMap((p) => p.cards.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Klondike', () => {
  it('sloupce mají 1 až 7 karet a jen vrchní je otočená', () => {
    const game = createPasiansy('klondike-rozdani', { variant: 'klondike' });
    for (let i = 0; i < 7; i++) {
      const pile = game.state.piles[`sloupec${i}`]!;
      expect(pile.cards).toHaveLength(i + 1);
      expect(pile.cards.filter((c) => c.faceUp)).toHaveLength(1);
      expect(pile.cards[pile.cards.length - 1]!.faceUp).toBe(true);
    }
  });

  it('na prázdný sloupec smí jen král', () => {
    const game = createPasiansy('kral', { variant: 'klondike' });
    setPile(game, 'sloupec0', []);
    setPile(game, 'sloupec1', [{ rank: 5, suit: 'srdce' }]);
    expect(game.canMove({ from: 'sloupec1', to: 'sloupec0', count: 1 })).toBe(false);

    setPile(game, 'sloupec1', [{ rank: 13, suit: 'srdce' }]);
    expect(game.canMove({ from: 'sloupec1', to: 'sloupec0', count: 1 })).toBe(true);
  });

  it('ve sloupci se pokládá jen na opačnou barvu a o jednu níž', () => {
    const game = createPasiansy('barvy', { variant: 'klondike' });
    setPile(game, 'sloupec0', [{ rank: 8, suit: 'piky' }]);

    setPile(game, 'sloupec1', [{ rank: 7, suit: 'srdce' }]);
    expect(game.canMove({ from: 'sloupec1', to: 'sloupec0', count: 1 })).toBe(true);

    setPile(game, 'sloupec1', [{ rank: 7, suit: 'kriz' }]);
    expect(game.canMove({ from: 'sloupec1', to: 'sloupec0', count: 1 })).toBe(false);

    setPile(game, 'sloupec1', [{ rank: 6, suit: 'srdce' }]);
    expect(game.canMove({ from: 'sloupec1', to: 'sloupec0', count: 1 })).toBe(false);
  });

  it('na cíl jde jako první jen eso, pak vzestupně ve stejné barvě', () => {
    const game = createPasiansy('cil', { variant: 'klondike' });
    setPile(game, 'cil0', []);
    setPile(game, 'sloupec0', [{ rank: 2, suit: 'srdce' }]);
    expect(game.canMove({ from: 'sloupec0', to: 'cil0', count: 1 })).toBe(false);

    setPile(game, 'sloupec0', [{ rank: 1, suit: 'srdce' }]);
    expect(game.applyMove({ from: 'sloupec0', to: 'cil0', count: 1 })).toBe(true);

    setPile(game, 'sloupec1', [{ rank: 2, suit: 'piky' }]);
    expect(game.canMove({ from: 'sloupec1', to: 'cil0', count: 1 })).toBe(false);

    setPile(game, 'sloupec1', [{ rank: 2, suit: 'srdce' }]);
    expect(game.canMove({ from: 'sloupec1', to: 'cil0', count: 1 })).toBe(true);
  });

  it('lízání po jedné přesune jednu kartu lícem nahoru', () => {
    const game = createPasiansy('lizani', { variant: 'klondike', drawCount: 1 });
    const before = game.state.piles.zasoba!.cards.length;
    expect(game.draw()).toBe(true);
    expect(game.state.piles.zasoba!.cards).toHaveLength(before - 1);
    expect(game.state.piles.odkladani!.cards).toHaveLength(1);
    expect(game.state.piles.odkladani!.cards[0]!.faceUp).toBe(true);
  });

  it('lízání po třech přesune tři karty', () => {
    const game = createPasiansy('lizani3', { variant: 'klondike', drawCount: 3 });
    game.draw();
    expect(game.state.piles.odkladani!.cards).toHaveLength(3);
  });

  it('prázdná zásoba se protočí z odkládání', () => {
    const game = createPasiansy('protoceni', { variant: 'klondike', drawCount: 3 });
    while (game.state.piles.zasoba!.cards.length > 0) game.draw();
    const inWaste = game.state.piles.odkladani!.cards.length;
    expect(inWaste).toBeGreaterThan(0);

    expect(game.draw()).toBe(true);
    expect(game.state.piles.zasoba!.cards).toHaveLength(inWaste);
    expect(game.state.piles.odkladani!.cards).toHaveLength(0);
    expect(game.state.recycles).toBe(1);
  });

  it('odkrytí karty pod přesunutou se započítá do skóre', () => {
    const game = createPasiansy('odkryti', { variant: 'klondike' });
    setPile(game, 'sloupec0', [
      { rank: 9, suit: 'kary', faceUp: false },
      { rank: 7, suit: 'srdce', faceUp: true },
    ]);
    setPile(game, 'sloupec1', [{ rank: 8, suit: 'piky' }]);
    const score = game.state.score;

    expect(game.applyMove({ from: 'sloupec0', to: 'sloupec1', count: 1 })).toBe(true);
    expect(game.state.piles.sloupec0!.cards[0]!.faceUp).toBe(true);
    expect(game.state.score).toBeGreaterThan(score);
  });

  it('posloupnost se přesune jen celá a jen když správně střídá barvy', () => {
    const game = createPasiansy('posloupnost', { variant: 'klondike' });
    setPile(game, 'sloupec0', [
      { rank: 9, suit: 'piky' },
      { rank: 8, suit: 'srdce' },
      { rank: 7, suit: 'kriz' },
    ]);
    setPile(game, 'sloupec1', [{ rank: 10, suit: 'kary' }]);
    expect(game.canMove({ from: 'sloupec0', to: 'sloupec1', count: 3 })).toBe(true);

    setPile(game, 'sloupec0', [
      { rank: 9, suit: 'piky' },
      { rank: 8, suit: 'kriz' }, // dvě černé za sebou
    ]);
    expect(game.canMove({ from: 'sloupec0', to: 'sloupec1', count: 2 })).toBe(false);
  });
});

describe('FreeCell', () => {
  it('rozdá všechny karty lícem nahoru do osmi sloupců', () => {
    const game = createPasiansy('freecell', { variant: 'freecell' });
    const cards = Object.values(game.state.piles).flatMap((p) => p.cards);
    expect(cards).toHaveLength(52);
    expect(cards.every((c) => c.faceUp)).toBe(true);
    expect(game.state.piles.zasoba).toBeUndefined();
  });

  it('volné místo pojme právě jednu kartu', () => {
    const game = createPasiansy('volne', { variant: 'freecell' });
    setPile(game, 'sloupec0', [{ rank: 5, suit: 'srdce' }, { rank: 9, suit: 'piky' }]);
    setPile(game, 'volne0', []);
    expect(game.applyMove({ from: 'sloupec0', to: 'volne0', count: 1 })).toBe(true);

    setPile(game, 'sloupec1', [{ rank: 3, suit: 'kary' }]);
    expect(game.canMove({ from: 'sloupec1', to: 'volne0', count: 1 })).toBe(false);
  });

  it('naráz se přesune jen tolik karet, kolik by šlo po jedné', () => {
    const game = createPasiansy('supermove', { variant: 'freecell' });
    // Zaplň všechna volná místa i sloupce, aby zbyla kapacita právě 1.
    for (const id of ['volne0', 'volne1', 'volne2', 'volne3']) {
      setPile(game, id, [{ rank: 13, suit: 'piky' }]);
    }
    for (let i = 0; i < 8; i++) setPile(game, `sloupec${i}`, [{ rank: 4, suit: 'kriz' }]);

    setPile(game, 'sloupec0', [{ rank: 9, suit: 'piky' }, { rank: 8, suit: 'srdce' }]);
    setPile(game, 'sloupec1', [{ rank: 10, suit: 'kary' }]);
    expect(game.canMove({ from: 'sloupec0', to: 'sloupec1', count: 2 })).toBe(false);

    // Uvolni jedno místo → kapacita 2, přesun projde.
    setPile(game, 'volne0', []);
    expect(game.canMove({ from: 'sloupec0', to: 'sloupec1', count: 2 })).toBe(true);
  });
});

describe('Pavouk', () => {
  it('má deset sloupců a dva balíčky', () => {
    const game = createPasiansy('pavouk', { variant: 'pavouk', spiderSuits: 4 });
    expect(Object.values(game.state.piles).filter((p) => p.kind === 'sloupec')).toHaveLength(10);
    expect(countCards(game)).toBe(104);
  });

  it('na jednu barvu opravdu rozdá jen jednu barvu', () => {
    const game = createPasiansy('pavouk1', { variant: 'pavouk', spiderSuits: 1 });
    const suits = new Set(
      Object.values(game.state.piles).flatMap((p) => p.cards.map((c) => c.suit)),
    );
    expect(suits.size).toBe(1);
  });

  it('pokládá se podle hodnoty bez ohledu na barvu', () => {
    const game = createPasiansy('pavouk-barvy', { variant: 'pavouk' });
    setPile(game, 'sloupec0', [{ rank: 8, suit: 'piky' }]);
    setPile(game, 'sloupec1', [{ rank: 7, suit: 'kriz' }]);
    expect(game.canMove({ from: 'sloupec1', to: 'sloupec0', count: 1 })).toBe(true);
  });

  it('naráz se hýbe jen posloupnost v jedné barvě', () => {
    const game = createPasiansy('pavouk-posloupnost', { variant: 'pavouk' });
    setPile(game, 'sloupec0', [{ rank: 8, suit: 'piky' }, { rank: 7, suit: 'piky' }]);
    setPile(game, 'sloupec1', [{ rank: 9, suit: 'kriz' }]);
    expect(game.canMove({ from: 'sloupec0', to: 'sloupec1', count: 2 })).toBe(true);

    setPile(game, 'sloupec0', [{ rank: 8, suit: 'piky' }, { rank: 7, suit: 'kriz' }]);
    expect(game.canMove({ from: 'sloupec0', to: 'sloupec1', count: 2 })).toBe(false);
  });

  it('hotová řada od krále po eso odejde na cíl sama', () => {
    const game = createPasiansy('pavouk-rada', { variant: 'pavouk' });
    // Sloupec s řadou od krále po dvojku a eso vedle.
    setPile(game, 'sloupec0', Array.from({ length: 12 }, (_, i) => ({
      rank: (13 - i) as never, suit: 'piky' as const,
    })));
    setPile(game, 'sloupec1', [{ rank: 1, suit: 'piky' }]);
    for (const id of ['cil0', 'cil1', 'cil2', 'cil3']) setPile(game, id, []);

    expect(game.applyMove({ from: 'sloupec1', to: 'sloupec0', count: 1 })).toBe(true);
    expect(game.state.piles.sloupec0!.cards).toHaveLength(0);
    expect(game.state.piles.cil0!.cards).toHaveLength(13);
  });

  it('rozdání ze zásoby nejde, dokud je některý sloupec prázdný', () => {
    const game = createPasiansy('pavouk-prazdny', { variant: 'pavouk' });
    setPile(game, 'sloupec3', []);
    expect(game.draw()).toBe(false);
  });
});

describe('tahy zpět, nápověda a dokončení', () => {
  it('krok zpět vrátí přesně předchozí stav', () => {
    const game = createPasiansy('zpet', { variant: 'klondike' });
    setPile(game, 'sloupec0', [{ rank: 1, suit: 'srdce' }]);
    setPile(game, 'cil0', []);
    const before = JSON.stringify(game.state.piles.sloupec0!.cards);

    game.applyMove({ from: 'sloupec0', to: 'cil0', count: 1 });
    expect(game.state.piles.sloupec0!.cards).toHaveLength(0);

    expect(game.undo()).toBe(true);
    expect(JSON.stringify(game.state.piles.sloupec0!.cards)).toBe(before);
    expect(game.state.piles.cil0!.cards).toHaveLength(0);
  });

  it('krok zpět bez historie nic neudělá', () => {
    const game = createPasiansy('zpet-prazdno', { variant: 'klondike' });
    expect(game.undo()).toBe(false);
  });

  it('nápověda vrací tah, který je opravdu platný', () => {
    const game = createPasiansy('napoveda', { variant: 'klondike' });
    const hint = game.hint();
    if (hint) expect(game.canMove(hint)).toBe(true);
  });

  it('automatické dokončení pošle nahoru vše, co jde', () => {
    const game = createPasiansy('dokonceni', { variant: 'klondike' });
    for (let i = 0; i < 7; i++) setPile(game, `sloupec${i}`, []);
    for (const id of ['cil0', 'cil1', 'cil2', 'cil3']) setPile(game, id, []);
    SUITS.forEach((suit, i) => setPile(game, `sloupec${i}`, [{ rank: 1, suit }]));

    expect(game.autoFinish()).toBe(4);
    expect(
      ['cil0', 'cil1', 'cil2', 'cil3'].reduce((n, id) => n + game.state.piles[id]!.cards.length, 0),
    ).toBe(4);
  });

  it('tapnutí najde nejlepší tah — přednost má cíl před sloupcem', () => {
    const game = createPasiansy('tap', { variant: 'klondike' });
    setPile(game, 'sloupec0', [{ rank: 1, suit: 'srdce' }]);
    setPile(game, 'sloupec1', [{ rank: 2, suit: 'piky' }]);
    for (const id of ['cil0', 'cil1', 'cil2', 'cil3']) setPile(game, id, []);

    expect(game.autoMove('sloupec0', 0)).toBe(true);
    expect(game.state.piles.cil0!.cards).toHaveLength(1);
  });

  it('hra je vyhraná, když jsou všechny karty na cílech', () => {
    const game = createPasiansy('vyhra', { variant: 'klondike' });
    for (let i = 0; i < 7; i++) setPile(game, `sloupec${i}`, []);
    SUITS.forEach((suit, i) => {
      setPile(game, `cil${i}`, Array.from({ length: 12 }, (_, r) => ({
        rank: (r + 1) as never, suit,
      })));
    });
    setPile(game, 'sloupec0', [{ rank: 13, suit: 'srdce' }]);
    setPile(game, 'sloupec1', [{ rank: 13, suit: 'kary' }]);
    setPile(game, 'sloupec2', [{ rank: 13, suit: 'kriz' }]);
    setPile(game, 'sloupec3', [{ rank: 13, suit: 'piky' }]);

    game.autoFinish();
    expect(game.state.won).toBe(true);
  });

  it('čas běží po ticích', () => {
    const game = createPasiansy('cas', { variant: 'klondike' });
    for (let i = 0; i < 60; i++) game.tick();
    expect(game.elapsedMs()).toBe(1000);
  });
});
