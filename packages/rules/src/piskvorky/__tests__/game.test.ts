import { describe, it, expect } from 'vitest';
import { createPiskvorky, WIN_LENGTH, type PiskvorkyGame, type Difficulty } from '../game.js';

/** Odehraje dvojice tahů: první hráč na `a`, druhý na `b`. */
function playPairs(game: PiskvorkyGame, pairs: [[number, number], [number, number]][]): void {
  for (const [a, b] of pairs) {
    game.place(a[0], a[1]);
    game.place(b[0], b[1]);
  }
}

describe('Piškvorky — základy', () => {
  it('vyhrává pět v řadě', () => {
    expect(WIN_LENGTH).toBe(5);
  });

  it('deska je na začátku prázdná a začíná křížek', () => {
    const game = createPiskvorky('start');
    expect(game.state.board.size).toBe(0);
    expect(game.state.current).toBe('x');
  });

  it('hráči se střídají', () => {
    const game = createPiskvorky('stridani');
    game.place(0, 0);
    expect(game.state.current).toBe('o');
    game.place(1, 0);
    expect(game.state.current).toBe('x');
  });

  it('na obsazené pole se nedá hrát', () => {
    const game = createPiskvorky('obsazene');
    game.place(0, 0);
    expect(game.place(0, 0)).toBe(false);
  });

  it('plocha je neomezená — hraje se i daleko od středu', () => {
    const game = createPiskvorky('daleko');
    expect(game.place(500, -300)).toBe(true);
    expect(game.markAt(500, -300)).toBe('x');
  });

  it('omezená plocha odmítne tah mimo', () => {
    const game = createPiskvorky('omezene', { width: 15, height: 15 });
    expect(game.place(7, 7)).toBe(true);
    expect(game.place(8, 0)).toBe(false);
  });
});

describe('Piškvorky — výhra', () => {
  it('pozná vodorovnou pětici', () => {
    const game = createPiskvorky('vodorovne');
    playPairs(game, [
      [[0, 0], [0, 5]], [[1, 0], [1, 5]], [[2, 0], [2, 5]], [[3, 0], [3, 5]],
    ]);
    game.place(4, 0);
    expect(game.state.winner).toBe('x');
    expect(game.state.winningLine).toHaveLength(5);
  });

  it('pozná svislou pětici', () => {
    const game = createPiskvorky('svisle');
    playPairs(game, [
      [[0, 0], [5, 0]], [[0, 1], [5, 1]], [[0, 2], [5, 2]], [[0, 3], [5, 3]],
    ]);
    game.place(0, 4);
    expect(game.state.winner).toBe('x');
  });

  it('pozná úhlopříčku', () => {
    const game = createPiskvorky('uhlopricka');
    playPairs(game, [
      [[0, 0], [9, 0]], [[1, 1], [9, 1]], [[2, 2], [9, 2]], [[3, 3], [9, 3]],
    ]);
    game.place(4, 4);
    expect(game.state.winner).toBe('x');
  });

  it('čtyři v řadě ještě nestačí', () => {
    const game = createPiskvorky('ctyri');
    playPairs(game, [[[0, 0], [0, 5]], [[1, 0], [1, 5]], [[2, 0], [2, 5]]]);
    game.place(3, 0);
    expect(game.state.winner).toBeNull();
  });

  it('šest v řadě je pořád výhra', () => {
    const game = createPiskvorky('sest');
    for (let i = 0; i < 5; i++) {
      game.place(i, 0);
      if (!game.state.winner) game.place(i, 5);
    }
    expect(game.state.winner).toBe('x');
  });

  it('po výhře už nejde hrát', () => {
    const game = createPiskvorky('po-vyhre');
    playPairs(game, [
      [[0, 0], [0, 5]], [[1, 0], [1, 5]], [[2, 0], [2, 5]], [[3, 0], [3, 5]],
    ]);
    game.place(4, 0);
    expect(game.place(9, 9)).toBe(false);
  });

  it('řada přerušená soupeřem není výhra', () => {
    const game = createPiskvorky('preruseno');
    game.place(0, 0);
    game.place(2, 0); // soupeř doprostřed
    game.place(1, 0);
    game.place(9, 9);
    game.place(3, 0);
    game.place(9, 8);
    game.place(4, 0);
    expect(game.state.winner).toBeNull();
  });
});

describe('Piškvorky — krok zpět', () => {
  it('vrátí desku i hráče na tahu', () => {
    const game = createPiskvorky('zpet');
    game.place(3, 3);
    expect(game.undo()).toBe(true);
    expect(game.markAt(3, 3)).toBeNull();
    expect(game.state.current).toBe('x');
  });

  it('zruší i výhru', () => {
    const game = createPiskvorky('zpet-vyhra');
    playPairs(game, [
      [[0, 0], [0, 5]], [[1, 0], [1, 5]], [[2, 0], [2, 5]], [[3, 0], [3, 5]],
    ]);
    game.place(4, 0);
    expect(game.state.winner).toBe('x');
    game.undo();
    expect(game.state.winner).toBeNull();
  });

  it('bez historie nic neudělá', () => {
    expect(createPiskvorky('prazdno').undo()).toBe(false);
  });
});

describe('Piškvorky — AI', () => {
  const levels: Difficulty[] = ['lehka', 'stredni', 'tezka'];

  it('na prázdné desce zahraje doprostřed', () => {
    const game = createPiskvorky('ai-start');
    expect(game.aiMove('tezka')).toEqual({ x: 0, y: 0 });
  });

  it('dokončí vlastní pětici', () => {
    const game = createPiskvorky('ai-vyhra');
    // Křížek má čtyři v řadě a je na tahu.
    playPairs(game, [[[0, 0], [0, 9]], [[1, 0], [1, 9]], [[2, 0], [2, 9]]]);
    game.place(3, 0);
    game.place(3, 9); // volné pole, ne už obsazené (2,9)
    expect(game.state.current).toBe('x');

    for (const level of levels) {
      const move = game.aiMove(level);
      expect([-1, 4]).toContain(move!.x);
      expect(move!.y).toBe(0);
    }
  });

  it('zablokuje soupeřovu čtyřku', () => {
    const game = createPiskvorky('ai-blok');
    // Kolečko má čtyři v řadě, křížek je na tahu a sám žádnou hrozbu nemá.
    game.place(20, 20);
    game.place(0, 0);
    game.place(25, 25);
    game.place(1, 0);
    game.place(30, 30);
    game.place(2, 0);
    game.place(35, 35);
    game.place(3, 0);
    expect(game.state.current).toBe('x');

    const move = game.aiMove('tezka');
    expect([-1, 4]).toContain(move!.x);
    expect(move!.y).toBe(0);
  });

  it('vrací vždy volné pole', () => {
    for (const level of levels) {
      const game = createPiskvorky(`ai-volne-${level}`);
      for (let i = 0; i < 30 && !game.state.winner; i++) {
        const move = game.aiMove(level)!;
        expect(game.markAt(move.x, move.y)).toBeNull();
        game.place(move.x, move.y);
      }
    }
  });

  it('těžká obtížnost porazí lehkou ve většině partií', () => {
    let hardWins = 0;
    const games = 6;
    for (let i = 0; i < games; i++) {
      const game = createPiskvorky(`souboj-${i}`, { width: 19, height: 19 });
      let guard = 0;
      while (!game.state.winner && !game.state.draw && guard++ < 361) {
        const level: Difficulty = game.state.current === 'x' ? 'tezka' : 'lehka';
        const move = game.aiMove(level);
        if (!move) break;
        game.place(move.x, move.y);
      }
      if (game.state.winner === 'x') hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(4);
  });

  it('stejný seed dá stejné tahy', () => {
    const run = (): string => {
      const game = createPiskvorky('determinismus');
      const moves: string[] = [];
      for (let i = 0; i < 12 && !game.state.winner; i++) {
        const move = game.aiMove('lehka')!;
        moves.push(`${move.x},${move.y}`);
        game.place(move.x, move.y);
      }
      return moves.join(' ');
    };
    expect(run()).toBe(run());
  });
});
