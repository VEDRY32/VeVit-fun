import { describe, it, expect } from 'vitest';
import {
  createKulickodraha, TRACK_COLS, ROWS_AHEAD, DEATH_Y, MIN_X, MAX_X, CAMERA_LOOKAHEAD,
  columnAtX, columnCenterX,
} from '../game.js';
import { BIT } from '../../input-bits.js';

describe('Kuličkodráha — generování dráhy', () => {
  it('vygeneruje dopředu dost řádků na vykreslení', () => {
    const game = createKulickodraha('start');
    expect(game.state.rows.length).toBeGreaterThanOrEqual(ROWS_AHEAD);
    for (const row of game.state.rows) expect(row).toHaveLength(TRACK_COLS);
  });

  it('prvních 35 řádků je vždy plných — bezpečný start', () => {
    const game = createKulickodraha('bezpecny-start');
    for (let r = 0; r < 35; r++) {
      expect(game.state.rows[r]).toEqual(Array(TRACK_COLS).fill(true));
    }
  });

  it('stejný seed dá stejnou dráhu', () => {
    const rowsFor = (seed: string): string => {
      const game = createKulickodraha(seed);
      for (let i = 0; i < 200; i++) game.step(0);
      return JSON.stringify(game.state.rows.slice(0, 100));
    };
    expect(rowsFor('shoda')).toBe(rowsFor('shoda'));
  });

  it('různé seedy dají různou dráhu za bezpečnou zónou', () => {
    const rowsFor = (seed: string): string => {
      const game = createKulickodraha(seed);
      return JSON.stringify(game.state.rows.slice(35, 80));
    };
    expect(rowsFor('seed-a')).not.toBe(rowsFor('seed-b'));
  });

  it('skóre roste, dokud hra běží', () => {
    const game = createKulickodraha('skore');
    let last = 0;
    for (let i = 0; i < 300; i++) {
      game.step(0);
      expect(game.state.score).toBeGreaterThanOrEqual(last);
      last = game.state.score;
    }
    expect(last).toBeGreaterThan(0);
  });

  it('rychlost roste ke stropu', () => {
    const game = createKulickodraha('rychlost');
    // Plná dráha — test míří na vzorec rychlosti, ne na přežití mezer.
    game.state.rows = Array.from({ length: 20000 }, () => Array(TRACK_COLS).fill(true));
    for (let i = 0; i < 20000; i++) game.step(0);
    expect(game.state.speed).toBeCloseTo(0.5, 1);
  });
});

/**
 * Dráha je vykreslená vycentrovaná na nule: dlaždice `j` zabírá herní x od
 * `j-3.5` do `j-2.5`, takže její střed leží na `j-3`. Kolize musí sahat na
 * tentýž sloupec, nad kterým kulička opravdu je — jinak hráč propadne
 * viditelně pevnou dlaždicí.
 */
describe('Kuličkodráha — souřadnice dráhy', () => {
  it('střed sloupce a sloupec pod polohou jsou navzájem opačné', () => {
    for (let j = 0; j < TRACK_COLS; j++) {
      expect(columnAtX(columnCenterX(j))).toBe(j);
    }
  });

  it('dráha je vycentrovaná na nule', () => {
    expect(columnCenterX(0)).toBe(-(TRACK_COLS - 1) / 2);
    expect(columnCenterX(TRACK_COLS - 1)).toBe((TRACK_COLS - 1) / 2);
  });

  it('kulička startuje uprostřed dráhy, ne na její hraně', () => {
    const game = createKulickodraha('start-uprostred');
    expect(game.state.x).toBe(0);
    expect(columnAtX(game.state.x)).toBe((TRACK_COLS - 1) / 2);
  });

  it('kulička nepropadne dlaždicí, která je pod ní vidět', () => {
    const game = createKulickodraha('pevna-dlazdice');
    // Pevný je jen ten jediný sloupec, nad kterým kulička opravdu stojí.
    // Kdyby kolize sáhla na kterýkoliv jiný, kulička propadne — a přesně
    // tak vypadá „hra se prohrála, i když jsem nikam nespadl".
    const under = columnAtX(game.state.x);
    const rows = Array.from({ length: 400 }, () => {
      const row = Array(TRACK_COLS).fill(false) as boolean[];
      row[under] = true;
      return row;
    });
    game.state.rows = rows;

    for (let i = 0; i < 600; i++) game.step(0);

    expect(game.state.over).toBe(false);
    expect(game.state.onGround).toBe(true);
  });

  it('díra přímo pod kuličkou ji naopak shodí', () => {
    const game = createKulickodraha('dira-pod-nohama');
    const under = columnAtX(game.state.x);
    const rows = Array.from({ length: 400 }, () => Array(TRACK_COLS).fill(true) as boolean[]);
    for (let r = 20; r < rows.length; r++) rows[r]![under] = false;
    game.state.rows = rows;

    let ticks = 0;
    while (!game.state.over && ticks < 2000) {
      game.step(0);
      ticks++;
    }
    expect(game.state.over).toBe(true);
  });
});

describe('Kuličkodráha — pohyb a skok', () => {
  it('řízení do stran posouvá kuličku a nepustí ji do nekonečna', () => {
    const game = createKulickodraha('rizeni');
    for (let i = 0; i < 500; i++) game.step(BIT.left);
    expect(game.state.x).toBeGreaterThanOrEqual(MIN_X);
    const afterLeft = game.state.x;

    const game2 = createKulickodraha('rizeni2');
    for (let i = 0; i < 500; i++) game2.step(BIT.right);
    expect(game2.state.x).toBeLessThanOrEqual(MAX_X);

    expect(afterLeft).toBeLessThan(game2.state.x);
  });

  it('mantinely jsou souměrné — dráha nemá jednu stranu delší', () => {
    expect(MIN_X).toBe(-MAX_X);
  });

  it('drženie skoku dá vyšší a delší skok než ťuknutí', () => {
    const solidRows = (): boolean[][] => Array.from({ length: 300 }, () => Array(TRACK_COLS).fill(true));

    const tapped = createKulickodraha('tap');
    tapped.state.rows = solidRows();
    tapped.step(BIT.a);
    tapped.step(0);
    let tapPeak = 0;
    let tapAirTicks = 0;
    while (!tapped.state.onGround && tapAirTicks < 200) {
      tapped.step(0);
      tapPeak = Math.max(tapPeak, tapped.state.y);
      tapAirTicks++;
    }

    const held = createKulickodraha('hold');
    held.state.rows = solidRows();
    let heldPeak = 0;
    let heldAirTicks = 0;
    held.step(BIT.a);
    while (!held.state.onGround && heldAirTicks < 200) {
      held.step(BIT.a);
      heldPeak = Math.max(heldPeak, held.state.y);
      heldAirTicks++;
    }

    expect(heldPeak).toBeGreaterThan(tapPeak);
    expect(heldAirTicks).toBeGreaterThan(tapAirTicks);
  });

  /**
   * Doba ve vzduchu sama o sobě nestačí — ta byla správná i tehdy, kdy skok
   * vynášel kuličku 29 dlaždic vysoko, tedy dávno mimo obraz. Hlídá se proto
   * výška v šířkách dlaždice, protože kamera je nízko nad dráhou.
   */
  it('skok zůstává v měřítku dráhy', () => {
    const peakOf = (hold: boolean): number => {
      const game = createKulickodraha('vyska');
      game.state.rows = Array.from({ length: 600 }, () => Array(TRACK_COLS).fill(true));
      game.step(BIT.a);
      let peak = 0;
      let ticks = 0;
      while (!game.state.onGround && ticks < 400) {
        game.step(hold ? BIT.a : 0);
        peak = Math.max(peak, game.state.y);
        ticks++;
      }
      return peak;
    };

    expect(peakOf(false)).toBeGreaterThan(0.6);
    expect(peakOf(false)).toBeLessThan(1.6);
    expect(peakOf(true)).toBeLessThan(2.5);
  });

  it('skok jde jen ze země, ne podruhé ve vzduchu', () => {
    const game = createKulickodraha('dvojskok');
    game.state.rows = Array.from({ length: 300 }, () => Array(TRACK_COLS).fill(true));
    game.step(BIT.a);
    game.step(0);
    const vyAfterFirstJump = game.state.vy;
    game.step(BIT.a); // druhý stisk ve vzduchu nesmí nic udělat
    expect(game.state.vy).toBeLessThanOrEqual(vyAfterFirstJump);
  });

  it('pád do mezery bez skoku ukončí hru', () => {
    const game = createKulickodraha('mezera');
    const col = columnAtX(game.state.x);
    const rows = Array.from({ length: 300 }, () => Array(TRACK_COLS).fill(true));
    // Mezera od bezpečné zóny dál, v celém sloupci pod hráčem.
    for (let r = 35; r < 100; r++) rows[r]![col] = false;
    game.state.rows = rows;

    let ticks = 0;
    while (!game.state.over && ticks < 2000) {
      game.step(0);
      ticks++;
    }
    expect(game.state.over).toBe(true);
    expect(game.state.y).toBeLessThan(DEATH_Y);
  });

  it('po konci hry se stav dál nemění', () => {
    const game = createKulickodraha('konec');
    game.state.over = true;
    const snapshot = JSON.stringify(game.state);
    game.step(BIT.a);
    expect(JSON.stringify(game.state)).toBe(snapshot);
  });

  it('stejný seed a stejné vstupy dají stejný běh', () => {
    const play = (): string => {
      const game = createKulickodraha('determinismus');
      for (let i = 0; i < 900; i++) {
        const mask = i % 90 < 20 ? BIT.left : i % 90 < 40 ? BIT.right : i % 150 === 0 ? BIT.a : 0;
        game.step(mask);
      }
      return JSON.stringify({
        x: Math.round(game.state.x * 1000),
        y: Math.round(game.state.y * 1000),
        z: Math.round(game.state.z * 1000),
        score: game.state.score,
        over: game.state.over,
      });
    };
    expect(play()).toBe(play());
  });
});

/**
 * Hratelnost. Kdyby se kolize a vykreslování rozešly v tom, nad kterým
 * sloupcem kulička je, hráč by mířil jinam, než kam sahá kolize, a padal by
 * skrz dlaždice, na kterých podle obrazovky stojí. Takový rozchod se navenek
 * projeví jako „hra se prohrává bezdůvodně", a tenhle test ho chytí: bot,
 * který řídí podle stejného mapování, musí přežít podstatně déle než kulička
 * ponechaná bez řízení (ta spadne kolem 163. tiku).
 */
describe('Kuličkodráha — hratelnost', () => {
  /** Míří na nejbližší pevnou dlaždici před sebou, nad dírou skáče. */
  const playBot = (seed: string, ticks: number): number => {
    const game = createKulickodraha(seed);
    for (let i = 0; i < ticks; i++) {
      const here = Math.floor(game.state.z) + CAMERA_LOOKAHEAD;
      const ahead = game.state.rows[here + 1] ?? game.state.rows[here];
      const col = columnAtX(game.state.x);
      let mask = 0;

      if (ahead) {
        const solid: number[] = [];
        for (let j = 0; j < TRACK_COLS; j++) if (ahead[j]) solid.push(j);
        if (solid.length > 0) {
          let best = solid[0]!;
          for (const j of solid) if (Math.abs(j - col) < Math.abs(best - col)) best = j;
          const target = columnCenterX(best);
          if (game.state.x < target - 0.05) mask |= BIT.right;
          else if (game.state.x > target + 0.05) mask |= BIT.left;
        } else {
          mask |= BIT.a;
        }
      }
      if (game.state.rows[here]?.[col] !== true && game.state.onGround) mask |= BIT.a;

      game.step(mask);
      if (game.state.over) return i;
    }
    return ticks;
  };

  it('kdo řídí, ten se na dráze udrží', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      expect(playBot(seed, 5000)).toBeGreaterThan(400);
    }
  });

  it('řízení je znát — bot vydrží násobně déle než kulička bez vstupu', () => {
    const game = createKulickodraha('c');
    let bezVstupu = 0;
    while (!game.state.over && bezVstupu < 5000) {
      game.step(0);
      bezVstupu++;
    }
    expect(playBot('c', 5000)).toBeGreaterThan(bezVstupu * 2);
  });
});
