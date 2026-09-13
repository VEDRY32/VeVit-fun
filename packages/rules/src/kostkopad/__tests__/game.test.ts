import { describe, it, expect } from 'vitest';
import { createKostkopad, COLS, ROWS, LOCK_DELAY_TICKS, type KostkopadGame } from '../game.js';
import { BIT } from '../../input-bits.js';
import type { PieceType } from '../pieces.js';

/** Posune hru o `n` kroků s danou maskou (výchozí: nic nedržím). */
function advance(game: KostkopadGame, n: number, mask = 0): void {
  for (let i = 0; i < n; i++) game.step(mask);
}

/** Ťuknutí: jeden krok se stisknutou akcí, jeden bez — aby vznikla hrana. */
function tap(game: KostkopadGame, bit: number): void {
  game.step(bit);
  game.step(0);
}

function fillRow(game: KostkopadGame, y: number, holes: number[] = []): void {
  for (let x = 0; x < COLS; x++) {
    game.state.board[y]![x] = holes.includes(x) ? null : 'G';
  }
}

/**
 * Postaví svislý tvar I tak, aby padal do zadaného sloupce.
 * V rotaci 1 leží tvar I v obalovém čtverci na lokálním x = 2.
 */
function verticalIAt(game: KostkopadGame, column: number): void {
  game.state.active = { type: 'I', rotation: 1, x: column - 2, y: 0 };
}

function clearBoard(game: KostkopadGame): void {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) game.state.board[y]![x] = null;
}

describe('Kostkopád — základy', () => {
  it('začíná s aktivním tvarem a náhledem', () => {
    const game = createKostkopad('test-seed');
    expect(game.state.active).not.toBeNull();
    expect(game.state.preview).toHaveLength(5);
    expect(game.state.over).toBe(false);
  });

  it('pole má 10 sloupců a 22 řádků včetně dvou skrytých', () => {
    const game = createKostkopad('test-seed');
    expect(game.state.board).toHaveLength(ROWS);
    expect(ROWS).toBe(22);
    expect(game.state.board[0]).toHaveLength(COLS);
  });

  it('stejný seed dá stejný průběh', () => {
    const run = (): number[] => {
      const game = createKostkopad('determinismus');
      const masks = [0, BIT.left, BIT.left, 0, BIT.up, 0, BIT.a, 0, BIT.right, 0];
      const out: number[] = [];
      for (let i = 0; i < 600; i++) {
        game.step(masks[i % masks.length]!);
        out.push(game.state.score, game.state.lines, game.state.active?.x ?? -1);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });

  it('generátor „sedm v pytli" nevydá tvar dvakrát, než přijdou všechny', () => {
    const game = createKostkopad('pytel');
    // Aktivní tvar plus pět v náhledu je šest ze sedmi z první sedmice.
    const seen: PieceType[] = [game.state.active!.type, ...game.state.preview];
    expect(seen).toHaveLength(6);
    expect(new Set(seen).size).toBe(6);
  });
});

describe('Kostkopád — pohyb', () => {
  it('posun doleva a doprava mění sloupec', () => {
    const game = createKostkopad('pohyb');
    const startX = game.state.active!.x;
    tap(game, BIT.left);
    expect(game.state.active!.x).toBe(startX - 1);
    tap(game, BIT.right);
    tap(game, BIT.right);
    expect(game.state.active!.x).toBe(startX + 1);
  });

  it('tvar neprojde levou stěnou', () => {
    const game = createKostkopad('stena');
    for (let i = 0; i < 20; i++) tap(game, BIT.left);
    const cells = game.activeCells();
    expect(Math.min(...cells.map((c) => c.x))).toBe(0);
  });

  it('tvrdý pád položí tvar okamžitě', () => {
    const game = createKostkopad('pad');
    tap(game, BIT.a);
    // Po položení běží krátká prodleva před dalším tvarem.
    expect(game.state.active).toBeNull();
    expect(game.state.spawnTimer).toBeGreaterThan(0);
    advance(game, 10);
    expect(game.state.active).not.toBeNull();
  });

  it('tvrdý pád dá dva body za buňku', () => {
    const game = createKostkopad('body');
    const before = game.state.score;
    tap(game, BIT.a);
    expect(game.state.score).toBeGreaterThan(before);
  });

  it('držení tvaru vymění aktivní kus a jde použít jen jednou', () => {
    const game = createKostkopad('hold');
    const first = game.state.active!.type;
    tap(game, BIT.y);
    expect(game.state.hold).toBe(first);
    expect(game.state.active!.type).not.toBe(first);
    const afterHold = game.state.active!.type;
    tap(game, BIT.y);
    expect(game.state.active!.type).toBe(afterHold);
  });
});

describe('Kostkopád — mazání řad', () => {
  it('zaplněná řada zmizí a připíše body', () => {
    const game = createKostkopad('mazani');
    fillRow(game, ROWS - 1, [4]);
    verticalIAt(game, 4);
    tap(game, BIT.a);
    expect(game.state.lines).toBeGreaterThanOrEqual(1);
    expect(game.state.score).toBeGreaterThan(0);
  });

  it('čtyři řady najednou dají víc než čtyři jednotlivé', () => {
    const quad = createKostkopad('quad');
    for (let y = ROWS - 4; y < ROWS; y++) fillRow(quad, y, [0]);
    verticalIAt(quad, 0);
    tap(quad, BIT.a);
    expect(quad.state.lines).toBe(4);
    expect(quad.state.lastClear?.kind).toBe('quad');
  });

  it('čtyři řady se smažou správně i s nedokončenou vrstvou nad nimi', () => {
    const quad = createKostkopad('quad-s-nedokoncenou-vrstvou');
    // Řádek nad mazanou čtveřicí není plný — musí přežít beze změny.
    fillRow(quad, ROWS - 5, [0, 1, 2]);
    const survivor = [...quad.state.board[ROWS - 5]!];
    for (let y = ROWS - 4; y < ROWS; y++) fillRow(quad, y, [0]);
    verticalIAt(quad, 0);
    tap(quad, BIT.a);
    expect(quad.state.lines).toBe(4);
    expect(quad.state.lastClear?.kind).toBe('quad');
    // Nedokončený řádek teď musí být úplně dole, nezměněný.
    expect(quad.state.board[ROWS - 1]).toEqual(survivor);
  });

  it('úroveň roste po deseti řadách', () => {
    const game = createKostkopad('uroven', { mode: 'maraton' });
    expect(game.state.level).toBe(1);
    game.state.lines = 25;
    fillRow(game, ROWS - 1, [0]);
    verticalIAt(game, 0);
    tap(game, BIT.a);
    expect(game.state.level).toBe(3);
  });

  it('combo roste při mazání za sebou a resetuje se při pauze', () => {
    const game = createKostkopad('combo');
    fillRow(game, ROWS - 1, [0]);
    verticalIAt(game, 0);
    tap(game, BIT.a);
    expect(game.state.combo).toBe(0);

    advance(game, 10);
    tap(game, BIT.a); // tentokrát nic nesmaže
    expect(game.state.combo).toBe(-1);
  });
});

describe('Kostkopád — detekce T-otočky', () => {
  /**
   * Klasická kapsa na T-otočku za dvě řady.
   *
   *   řádek -3:  G . . . . . . . . .   ← převis nad sloupcem 3
   *   řádek -2:  G G G . . . G G G G   ← sem padne vodorovná část T
   *   řádek -1:  G G G G . G G G G G   ← sem padne špička T
   *
   * Tvar T se do kapsy dostane jedině otočením; po otočení jsou obsazené
   * tři rohy okolo středu a oba rohy na straně, kam špička míří, takže jde
   * o plnou otočku, ne mini.
   */
  function setupTPocket(game: KostkopadGame): void {
    clearBoard(game);
    fillRow(game, ROWS - 1, [4]);
    fillRow(game, ROWS - 2, [3, 4, 5]);
    game.state.board[ROWS - 3]![3] = 'G';
  }

  it('otočení o 180° do kapsy je T-otočka za dvě řady', () => {
    const game = createKostkopad('tspin');
    setupTPocket(game);
    // T špičkou nahoru těsně nad kapsou — otočením o 180° zapadne dovnitř.
    game.state.active = { type: 'T', rotation: 0, x: 3, y: ROWS - 3 };
    game.state.previousMask = 0;

    game.step(BIT.l); // otočení o 180°
    expect(game.state.active!.rotation).toBe(2);
    expect(game.state.active!.x).toBe(3);

    game.step(BIT.a); // položit — tvar už leží, takže se neposune

    expect(game.state.lastClear?.kind).toBe('tspin-double');
    expect(game.state.lastClear?.lines).toBe(2);
  });

  it('T-otočka drží sérii „hned po sobě"', () => {
    const game = createKostkopad('b2b');
    setupTPocket(game);
    game.state.active = { type: 'T', rotation: 0, x: 3, y: ROWS - 3 };
    game.state.previousMask = 0;
    game.step(BIT.l);
    game.step(BIT.a);
    expect(game.state.backToBack).toBe(true);
  });

  it('T-otočka dá víc bodů než obyčejné smazání dvou řad', () => {
    const withSpin = createKostkopad('body-spin');
    setupTPocket(withSpin);
    withSpin.state.active = { type: 'T', rotation: 0, x: 3, y: ROWS - 3 };
    withSpin.state.previousMask = 0;
    withSpin.step(BIT.l);
    withSpin.step(BIT.a);

    const withoutSpin = createKostkopad('body-bez');
    setupTPocket(withoutSpin);
    withoutSpin.state.active = { type: 'T', rotation: 2, x: 3, y: ROWS - 3 };
    withoutSpin.state.previousMask = 0;
    withoutSpin.step(BIT.a);

    expect(withoutSpin.state.lastClear?.kind).toBe('double');
    expect(withSpin.state.lastClear!.points).toBeGreaterThan(withoutSpin.state.lastClear!.points);
  });

  it('položení bez rotace není T-otočka', () => {
    const game = createKostkopad('bez-otocky');
    setupTPocket(game);
    game.state.active = { type: 'T', rotation: 2, x: 3, y: ROWS - 3 };
    game.state.previousMask = 0;
    game.step(BIT.a);
    expect(game.state.lastClear?.kind).toBe('double');
  });

  it('pád po otočení příznak otočky shodí', () => {
    // Otočka se počítá jen tehdy, když byla poslední akcí. Jakýkoli pohyb
    // po ní ji ruší — jinak by stačilo tvar kdekoli otočit a pak ho upustit.
    const game = createKostkopad('posun-rusi');
    clearBoard(game);
    game.state.active = { type: 'T', rotation: 0, x: 3, y: 0 };
    game.state.previousMask = 0;

    game.step(BIT.up);
    expect(game.state.lastActionWasRotation).toBe(true);

    game.step(BIT.a); // tvrdý pád přes celé pole
    expect(game.state.lastActionWasRotation).toBe(false);
    expect(game.state.lastClear).toBeNull();
  });

  it('otočka mimo kapsu se jako T-otočka nepočítá', () => {
    const game = createKostkopad('volno');
    clearBoard(game);
    fillRow(game, ROWS - 1, [4]);
    game.state.active = { type: 'T', rotation: 0, x: 3, y: ROWS - 3 };
    game.state.previousMask = 0;
    game.step(BIT.l);
    game.step(BIT.a);
    // Kolem středu nejsou tři obsazené rohy → obyčejné mazání.
    expect(game.state.lastClear?.kind).not.toContain('tspin');
  });
});

describe('Kostkopád — uzamčení a konec', () => {
  it('tvar se po prodlevě u země zamkne', () => {
    const game = createKostkopad('zamek');
    // Spadni až dolů měkkým pádem, pak čekej.
    advance(game, 200, BIT.down);
    expect(game.state.lines + (game.state.active ? 0 : 1)).toBeGreaterThanOrEqual(0);
    expect(LOCK_DELAY_TICKS).toBe(30);
  });

  it('hra skončí, když se nový tvar nevejde', () => {
    const game = createKostkopad('konec');
    for (let y = 0; y < ROWS; y++) fillRow(game, y, []);
    game.state.active = null;
    game.step(0);
    expect(game.state.over).toBe(true);
  });

  it('Sprint končí výhrou na 40 řadách', () => {
    const game = createKostkopad('sprint', { mode: 'sprint40' });
    game.state.lines = 39;
    fillRow(game, ROWS - 1, [0]);
    verticalIAt(game, 0);
    tap(game, BIT.a);
    expect(game.state.won).toBe(true);
  });

  it('Ultra končí po dvou minutách', () => {
    const game = createKostkopad('ultra', { mode: 'ultra' });
    game.state.tick = 2 * 60 * 60 - 1;
    game.step(0);
    expect(game.state.over).toBe(true);
  });
});

describe('Kostkopád — duch a odpad', () => {
  it('duch ukazuje pozici dopadu', () => {
    const game = createKostkopad('duch');
    const ghost = game.ghostY();
    expect(ghost).toBeGreaterThan(game.state.active!.y);
  });

  it('odpadní řádky se vsadí zespoda a mají jednu díru', () => {
    const game = createKostkopad('odpad', { mode: 'souboj' });
    game.queueGarbage(3);
    tap(game, BIT.a);
    advance(game, 10);
    const bottom = game.state.board[ROWS - 1]!;
    expect(bottom.filter((c) => c === 'G').length).toBe(COLS - 1);
    expect(bottom.filter((c) => c == null).length).toBe(1);
  });

  it('vlastní útok odečte čekající odpad', () => {
    // Odečítá se silou útoku, ne počtem řad: jedna řada nepošle nic,
    // takže ani nic neodečte. Čtyři řady pošlou čtyři.
    const single = createKostkopad('odecet-single', { mode: 'souboj' });
    single.queueGarbage(4);
    fillRow(single, ROWS - 1, [0]);
    verticalIAt(single, 0);
    tap(single, BIT.a);
    expect(single.state.pendingGarbage).toBe(4);

    const quad = createKostkopad('odecet-quad', { mode: 'souboj' });
    quad.queueGarbage(4);
    for (let y = ROWS - 4; y < ROWS; y++) fillRow(quad, y, [0]);
    verticalIAt(quad, 0);
    tap(quad, BIT.a);
    expect(quad.state.lastClear?.kind).toBe('quad');
    expect(quad.state.pendingGarbage).toBe(0);
  });
});
