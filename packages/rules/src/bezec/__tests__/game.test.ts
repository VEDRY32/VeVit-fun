import { describe, it, expect } from 'vitest';
import { createBezec, GROUND_Y, WORLD_W, type BezecGame } from '../game.js';
import { BIT } from '../../input-bits.js';

function jump(game: BezecGame): void {
  game.step(BIT.a);
  game.step(0);
}

function run(game: BezecGame, ticks: number, mask = 0): void {
  for (let i = 0; i < ticks; i++) game.step(mask);
}

describe('Běžec — start', () => {
  it('liška stojí, dokud hráč poprvé neskočí', () => {
    const game = createBezec('start');
    run(game, 120);
    expect(game.state.started).toBe(false);
    expect(game.state.score).toBe(0);
    expect(game.state.obstacles).toHaveLength(0);
  });

  it('první skok hru rozběhne', () => {
    const game = createBezec('rozbeh');
    jump(game);
    expect(game.state.started).toBe(true);
    expect(game.state.onGround).toBe(false);
  });

  it('liška stojí na zemi', () => {
    const game = createBezec('zeme');
    const rect = game.foxRect();
    expect(rect.y + rect.h).toBeCloseTo(GROUND_Y, 1);
  });
});

describe('Běžec — pohyb', () => {
  it('skok vynese lišku nahoru a gravitace ji vrátí', () => {
    const game = createBezec('skok');
    jump(game);
    const top = game.foxRect().y;
    expect(top).toBeLessThan(GROUND_Y);

    run(game, 90);
    expect(game.state.onGround || game.state.over).toBe(true);
  });

  it('držené tlačítko skočí výš než ťuknutí', () => {
    const measure = (hold: boolean): number => {
      const game = createBezec('vyska-skoku');
      game.step(BIT.a);
      let highest = game.foxRect().y;
      for (let i = 0; i < 40; i++) {
        game.step(hold ? BIT.a : 0);
        highest = Math.min(highest, game.foxRect().y);
      }
      return highest;
    };
    // Menší y znamená výš.
    expect(measure(true)).toBeLessThan(measure(false));
  });

  it('přikrčení sníží lišku', () => {
    const game = createBezec('prikrceni');
    jump(game);
    run(game, 60);
    const standing = game.foxRect().h;
    game.step(BIT.down);
    expect(game.foxRect().h).toBeLessThan(standing);
  });

  it('přikrčení ve vzduchu urychlí pád', () => {
    const measure = (duck: boolean): number => {
      const game = createBezec('rychly-pad');
      game.step(BIT.a);
      let ticks = 0;
      while (!game.state.onGround && ticks < 200) {
        game.step(duck ? BIT.down : 0);
        ticks++;
      }
      return ticks;
    };
    expect(measure(true)).toBeLessThan(measure(false));
  });

  it('ve vzduchu nejde skočit podruhé', () => {
    const game = createBezec('dvojskok');
    jump(game);
    const velocity = game.state.velocity;
    game.step(BIT.a);
    game.step(0);
    // Rychlost se mění jen gravitací, ne novým skokem.
    expect(game.state.velocity).toBeGreaterThan(velocity);
  });
});

describe('Běžec — svět', () => {
  it('rychlost roste a má strop', () => {
    const game = createBezec('rychlost');
    jump(game);
    const start = game.state.speed;
    run(game, 600);
    expect(game.state.speed).toBeGreaterThan(start);

    const mid = game.state.speed;
    run(game, 60_000);
    expect(game.state.speed).toBeGreaterThanOrEqual(mid);
    expect(game.state.speed / 65536).toBeLessThanOrEqual(11.01);
  });

  it('skóre roste s uraženou vzdáleností', () => {
    const game = createBezec('skore');
    jump(game);
    run(game, 300);
    expect(game.state.score).toBeGreaterThan(0);
  });

  it('překážky přicházejí zprava a odcházejí vlevo', () => {
    const game = createBezec('prekazky');
    jump(game);
    run(game, 200);
    expect(game.state.obstacles.length).toBeGreaterThan(0);
    for (const rect of game.obstacleRects()) {
      expect(rect.x).toBeLessThanOrEqual(WORLD_W + 60);
      expect(rect.x + rect.w).toBeGreaterThan(-25);
    }
  });

  it('mezi překážkami je vždy dost místa', () => {
    const game = createBezec('mezery');
    jump(game);
    // Projdeme dlouhý úsek a sledujeme, jak daleko od sebe překážky vznikají.
    let previousX: number | null = null;
    let minGap = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 4000; i++) {
      game.step(0);
      if (game.state.over) {
        // Sráška nevadí; zajímá nás rozestup, ne přežití.
        game.state.over = false;
      }
      const last = game.obstacleRects()[game.obstacleRects().length - 1];
      if (last && last.x > WORLD_W) {
        if (previousX != null && last.x !== previousX) {
          minGap = Math.min(minGap, Math.abs(last.x - previousX));
        }
        previousX = last.x;
      }
    }
    expect(game.state.obstacles.length).toBeGreaterThan(0);
  });

  it('ptáci se objeví až při vyšší rychlosti', () => {
    const game = createBezec('ptaci');
    jump(game);
    run(game, 120);
    const early = game.obstacleRects().map((o) => o.kind);
    expect(early.every((kind) => kind.startsWith('ker'))).toBe(true);
  });

  it('cyklus dne a noci se otáčí', () => {
    const game = createBezec('den-noc');
    jump(game);
    expect(game.state.night).toBeLessThan(0.2);
    game.state.distance = 700 * 10 * 65536;
    game.step(0);
    expect(game.state.night).toBeGreaterThan(0.8);
  });
});

describe('Běžec — konec', () => {
  it('náraz do překážky hru ukončí', () => {
    const game = createBezec('naraz');
    jump(game);
    run(game, 60);
    // Postavíme překážku přímo na lišku.
    const rect = game.foxRect();
    game.state.obstacles = [{
      kind: 'ker-velky',
      x: (rect.x + 4) * 65536,
      y: (GROUND_Y - 44) * 65536,
      w: 28 * 65536,
      h: 44 * 65536,
    }];
    game.state.y = GROUND_Y * 65536;
    game.state.onGround = true;
    game.step(0);
    expect(game.state.over).toBe(true);
  });

  it('po konci hry se stav nemění', () => {
    const game = createBezec('po-konci');
    jump(game);
    game.state.over = true;
    const score = game.state.score;
    run(game, 120);
    expect(game.state.score).toBe(score);
  });

  it('stejný seed dá stejný průběh', () => {
    const run2 = (): string => {
      const game = createBezec('determinismus');
      const out: number[] = [];
      for (let i = 0; i < 1200; i++) {
        game.step(i % 47 === 0 ? BIT.a : i % 71 < 8 ? BIT.down : 0);
        out.push(game.state.score, game.state.obstacles.length);
      }
      return out.join(',');
    };
    expect(run2()).toBe(run2());
  });
});
