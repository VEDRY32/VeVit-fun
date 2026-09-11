import { describe, it, expect } from 'vitest';
import { createCtyriVRade, CTYRI_COLS, CTYRI_ROWS, type CtyriGame, type Difficulty } from '../game.js';

/** Odehraje posloupnost sloupců. */
function play(game: CtyriGame, cols: number[]): void {
  for (const col of cols) game.drop(col);
}

describe('Čtyři v řadě — základy', () => {
  it('má sedm sloupců po šesti polích', () => {
    const game = createCtyriVRade('start');
    expect(game.state.board).toHaveLength(CTYRI_COLS);
    expect(game.state.board[0]).toHaveLength(CTYRI_ROWS);
    expect(CTYRI_COLS).toBe(7);
    expect(CTYRI_ROWS).toBe(6);
  });

  it('žeton padá na nejnižší volné místo', () => {
    const game = createCtyriVRade('gravitace');
    expect(game.drop(3)).toBe(0);
    expect(game.drop(3)).toBe(1);
    expect(game.drop(3)).toBe(2);
  });

  it('hráči se střídají', () => {
    const game = createCtyriVRade('stridani');
    expect(game.state.current).toBe(1);
    game.drop(0);
    expect(game.state.current).toBe(2);
    game.drop(1);
    expect(game.state.current).toBe(1);
  });

  it('do plného sloupce se nedá házet', () => {
    const game = createCtyriVRade('plny');
    for (let i = 0; i < CTYRI_ROWS; i++) game.drop(0);
    expect(game.drop(0)).toBe(-1);
    expect(game.legalMoves()).not.toContain(0);
  });

  it('sloupec mimo desku se odmítne', () => {
    const game = createCtyriVRade('mimo');
    expect(game.drop(-1)).toBe(-1);
    expect(game.drop(CTYRI_COLS)).toBe(-1);
  });
});

describe('Čtyři v řadě — výhra', () => {
  it('pozná vodorovnou čtveřici', () => {
    const game = createCtyriVRade('vodorovne');
    play(game, [0, 0, 1, 1, 2, 2, 3]);
    expect(game.state.winner).toBe(1);
    expect(game.state.winningCells).toHaveLength(4);
  });

  it('pozná svislou čtveřici', () => {
    const game = createCtyriVRade('svisle');
    play(game, [0, 1, 0, 1, 0, 1, 0]);
    expect(game.state.winner).toBe(1);
  });

  it('pozná úhlopříčku nahoru', () => {
    const game = createCtyriVRade('uhlopricka');
    // Postaví schody: hráč 1 získá (0,0),(1,1),(2,2),(3,3).
    play(game, [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(game.state.winner).toBe(1);
  });

  it('pozná úhlopříčku dolů', () => {
    const game = createCtyriVRade('uhlopricka2');
    play(game, [6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]);
    expect(game.state.winner).toBe(1);
  });

  it('tři v řadě ještě nejsou výhra', () => {
    const game = createCtyriVRade('tri');
    play(game, [0, 0, 1, 1, 2, 2]);
    expect(game.state.winner).toBeNull();
  });

  it('po výhře už nejde hrát dál', () => {
    const game = createCtyriVRade('po-vyhre');
    play(game, [0, 0, 1, 1, 2, 2, 3]);
    expect(game.drop(5)).toBe(-1);
  });

  it('zaplněná deska bez čtveřice je remíza', () => {
    const game = createCtyriVRade('remiza');
    /**
     * Vzor, ve kterém nikdo nemá čtyři v řadě: každý sloupec je zdola tři
     * žetony jednoho hráče a shora tři druhého, a sousední sloupce mají
     * pořadí obrácené. Svisle tak vznikají nejvýš trojice, vodorovně se
     * hráči střídají po jednom a na úhlopříčkách se barva mění taky.
     */
    for (let col = 0; col < CTYRI_COLS; col++) {
      for (let row = 0; row < CTYRI_ROWS; row++) {
        const bottomHalf = row < 3;
        const evenColumn = col % 2 === 0;
        game.state.board[col]![row] = (bottomHalf === evenColumn ? 1 : 2);
      }
    }

    // Poslední pole necháme volné a dohrajeme ho normálním tahem, aby se
    // remíza vyhodnotila stejnou cestou jako v opravdové partii.
    game.state.board[0]![CTYRI_ROWS - 1] = 0;
    game.state.current = 2;
    game.drop(0);

    expect(game.state.winner).toBeNull();
    expect(game.state.draw).toBe(true);
    expect(game.legalMoves()).toHaveLength(0);
  });
});

describe('Čtyři v řadě — krok zpět', () => {
  it('vrátí desku i hráče na tahu', () => {
    const game = createCtyriVRade('zpet');
    game.drop(3);
    expect(game.state.current).toBe(2);
    expect(game.undo()).toBe(true);
    expect(game.state.board[3]![0]).toBe(0);
    expect(game.state.current).toBe(1);
    expect(game.state.moves).toBe(0);
  });

  it('krok zpět zruší i výhru', () => {
    const game = createCtyriVRade('zpet-vyhra');
    play(game, [0, 0, 1, 1, 2, 2, 3]);
    expect(game.state.winner).toBe(1);
    game.undo();
    expect(game.state.winner).toBeNull();
    expect(game.state.winningCells).toHaveLength(0);
  });

  it('krok zpět bez historie nic neudělá', () => {
    expect(createCtyriVRade('prazdno').undo()).toBe(false);
  });
});

describe('Čtyři v řadě — AI', () => {
  it('vezme okamžitou výhru', () => {
    const game = createCtyriVRade('ai-vyhra');
    // Hráč 1 má tři v řadě na 0,1,2 a je na tahu.
    play(game, [0, 6, 1, 6, 2, 6]);
    expect(game.state.current).toBe(1);
    for (const level of ['lehka', 'stredni', 'tezka'] as Difficulty[]) {
      expect(game.aiMove(level)).toBe(3);
    }
  });

  it('zablokuje okamžitou prohru', () => {
    const game = createCtyriVRade('ai-blok');
    // Hráč 2 má trojici na sloupcích 0-2 a hrozí výhrou na sloupci 3.
    // Hráč 1 na tahu žádnou vlastní výhru nemá, takže musí blokovat.
    play(game, [6, 0, 6, 1, 5, 2]);
    expect(game.state.current).toBe(1);
    expect(game.aiMove('tezka')).toBe(3);
    expect(game.aiMove('stredni')).toBe(3);
  });

  it('vrací vždy legální tah', () => {
    for (const level of ['lehka', 'stredni', 'tezka'] as Difficulty[]) {
      const game = createCtyriVRade(`ai-legalni-${level}`);
      for (let i = 0; i < 20 && !game.state.winner && !game.state.draw; i++) {
        const col = game.aiMove(level);
        expect(game.legalMoves()).toContain(col);
        game.drop(col);
      }
    }
  });

  it('těžká obtížnost porazí lehkou ve většině partií', () => {
    let hardWins = 0;
    const games = 8;
    for (let i = 0; i < games; i++) {
      const game = createCtyriVRade(`souboj-${i}`);
      // Těžká hraje za hráče 1, lehká za hráče 2.
      while (!game.state.winner && !game.state.draw) {
        game.drop(game.aiMove(game.state.current === 1 ? 'tezka' : 'lehka'));
      }
      if (game.state.winner === 1) hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(6);
  });

  it('na plné desce vrací -1', () => {
    const game = createCtyriVRade('ai-plno');
    for (let col = 0; col < CTYRI_COLS; col++) {
      for (let row = 0; row < CTYRI_ROWS; row++) {
        game.state.board[col]![row] = ((col + row) % 2 === 0 ? 1 : 2);
      }
    }
    expect(game.aiMove('tezka')).toBe(-1);
  });

  it('stejný seed dá u lehké obtížnosti stejné tahy', () => {
    const run = (): number[] => {
      const game = createCtyriVRade('determinismus');
      const moves: number[] = [];
      for (let i = 0; i < 10 && !game.state.winner && !game.state.draw; i++) {
        const col = game.aiMove('lehka');
        moves.push(col);
        game.drop(col);
      }
      return moves;
    };
    expect(run()).toEqual(run());
  });
});
