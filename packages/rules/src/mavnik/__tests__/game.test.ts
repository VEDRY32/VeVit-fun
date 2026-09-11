import { describe, it, expect } from 'vitest';
import { createMavnik, WORLD_H, type MavnikGame } from '../game.js';
import { BIT } from '../../input-bits.js';

/** Mávnutí: krok se stiskem, krok bez něj — jinak nevznikne hrana. */
function flap(game: MavnikGame): void {
  game.step(BIT.a);
  game.step(0);
}

function glide(game: MavnikGame, ticks: number): void {
  for (let i = 0; i < ticks; i++) game.step(0);
}

describe('Mávník', () => {
  it('začíná uprostřed a nepadá, dokud hráč nemávne', () => {
    const game = createMavnik('start');
    const y = game.birdY();
    glide(game, 120);
    expect(game.birdY()).toBe(y);
    expect(game.state.started).toBe(false);
    expect(game.state.over).toBe(false);
  });

  it('po prvním mávnutí hra začne a drak stoupá', () => {
    const game = createMavnik('start2');
    const before = game.birdY();
    flap(game);
    expect(game.state.started).toBe(true);
    expect(game.birdY()).toBeLessThan(before);
  });

  it('gravitace drak stáhne dolů', () => {
    const game = createMavnik('gravitace');
    flap(game);
    const top = game.birdY();
    glide(game, 40);
    expect(game.birdY()).toBeGreaterThan(top);
  });

  it('rychlost pádu má strop', () => {
    const game = createMavnik('strop');
    flap(game);
    glide(game, 20);
    const positions: number[] = [];
    for (let i = 0; i < 10; i++) {
      const before = game.birdY();
      game.step(0);
      positions.push(game.birdY() - before);
      if (game.state.over) break;
    }
    // Poslední přírůstky se už nesmí zvětšovat.
    const last = positions[positions.length - 1] ?? 0;
    expect(last).toBeLessThanOrEqual(12);
  });

  it('pád na zem hru ukončí', () => {
    const game = createMavnik('zem');
    flap(game);
    glide(game, 600);
    expect(game.state.over).toBe(true);
    expect(game.birdY()).toBeLessThanOrEqual(WORLD_H);
  });

  it('náraz do stropu hru ukončí', () => {
    const game = createMavnik('strop-narazi');
    for (let i = 0; i < 200 && !game.state.over; i++) flap(game);
    expect(game.state.over).toBe(true);
  });

  it('stejný seed dá stejné překážky', () => {
    const a = createMavnik('stejne');
    const b = createMavnik('stejne');
    expect(a.pipeRects()).toEqual(b.pipeRects());
  });

  it('různý seed dá jiné překážky', () => {
    expect(createMavnik('a').pipeRects()).not.toEqual(createMavnik('b').pipeRects());
  });

  it('stejný seed dá při stejných vstupech stejný průběh', () => {
    const run = (): number[] => {
      const game = createMavnik('determinismus');
      const out: number[] = [];
      for (let i = 0; i < 300; i++) {
        game.step(i % 22 === 0 ? BIT.a : 0);
        out.push(Math.round(game.birdY() * 1000), game.state.score);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });

  it('překážky mají vždy dvě části a mezeru mezi nimi', () => {
    const game = createMavnik('mezery');
    const rects = game.pipeRects();
    expect(rects.length % 2).toBe(0);
    for (let i = 0; i < rects.length; i += 2) {
      const top = rects[i]!;
      const bottom = rects[i + 1]!;
      const gap = bottom.y - (top.y + top.h);
      expect(gap).toBeGreaterThan(100);
      expect(top.h).toBeGreaterThan(0);
      expect(bottom.h).toBeGreaterThan(0);
    }
  });

  it('medaile odpovídají skóre', () => {
    const game = createMavnik('medaile');
    expect(game.medal()).toBe('zadna');
    game.state.score = 10;
    expect(game.medal()).toBe('bronz');
    game.state.score = 25;
    expect(game.medal()).toBe('stribro');
    game.state.score = 50;
    expect(game.medal()).toBe('zlato');
  });

  it('po konci hry se stav nemění', () => {
    const game = createMavnik('po-konci');
    flap(game);
    glide(game, 600);
    expect(game.state.over).toBe(true);
    const snapshot = JSON.stringify({ y: game.birdY(), score: game.state.score });
    glide(game, 60);
    expect(JSON.stringify({ y: game.birdY(), score: game.state.score })).toBe(snapshot);
  });
});
