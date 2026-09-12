import { describe, it, expect } from 'vitest';
import { createKulickodraha, TRACK_COLS, ROWS_AHEAD, DEATH_Y } from '../game.js';
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

describe('Kuličkodráha — pohyb a skok', () => {
  it('řízení do stran posouvá kuličku a nepustí ji do nekonečna', () => {
    const game = createKulickodraha('rizeni');
    for (let i = 0; i < 500; i++) game.step(BIT.left);
    expect(game.state.x).toBeGreaterThanOrEqual(-2);
    const afterLeft = game.state.x;

    const game2 = createKulickodraha('rizeni2');
    for (let i = 0; i < 500; i++) game2.step(BIT.right);
    expect(game2.state.x).toBeLessThanOrEqual(TRACK_COLS + 1);

    expect(afterLeft).toBeLessThan(game2.state.x);
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
    const col = Math.round(game.state.x);
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
