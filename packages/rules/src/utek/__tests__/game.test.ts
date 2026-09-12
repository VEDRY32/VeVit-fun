import { describe, it, expect } from 'vitest';
import { createUtek, LANES, LANE_Y, RUNNER_X, type UtekGame } from '../game.js';
import { BIT } from '../../input-bits.js';

function run(game: UtekGame, mask: number, ticks: number): void {
  for (let i = 0; i < ticks; i++) game.step(mask);
}

describe('Útěk', () => {
  it('začíná v prostředním pruhu a rozbíhá se', () => {
    const game = createUtek('start');
    expect(game.state.lane).toBe(1);
    const before = game.state.speed;
    run(game, 0, 300);
    expect(game.state.speed).toBeGreaterThan(before);
    expect(game.state.score).toBeGreaterThan(0);
  });

  it('stejný seed dá stejný průběh', () => {
    const play = (): string => {
      const game = createUtek('shoda');
      for (let i = 0; i < 900; i++) game.step(i % 120 === 0 ? BIT.up : 0);
      return JSON.stringify({
        score: game.state.score,
        chase: Math.round(game.state.chase * 1000),
        obstacles: game.state.obstacles.map((o) => [o.kind, o.lane, Math.round(o.x)]),
      });
    };
    expect(play()).toBe(play());
  });

  it('šipky přepínají pruhy a za okraj nepustí', () => {
    const game = createUtek('pruhy');
    game.step(BIT.up);
    expect(game.state.lane).toBe(0);
    game.step(0);
    game.step(BIT.up);
    expect(game.state.lane).toBe(0);
    game.step(0);
    game.step(BIT.down);
    game.step(0);
    game.step(BIT.down);
    expect(game.state.lane).toBe(LANES - 1);
  });

  it('přeskok mezi pruhy chvíli trvá', () => {
    const game = createUtek('prechod');
    game.step(BIT.up);
    expect(game.state.y).toBeGreaterThan(LANE_Y[0]!);
    run(game, 0, 20);
    expect(game.state.y).toBe(LANE_Y[0]!);
  });

  it('skok se vrátí na zem a nejde skákat ve vzduchu', () => {
    const game = createUtek('skok');
    game.step(BIT.a);
    expect(game.state.hop).toBeGreaterThan(0);
    const inAir = game.state.hop;
    game.step(0);
    game.step(BIT.a);
    // Druhý stisk ve vzduchu nic nepřidá — výška jde dál podle gravitace.
    expect(game.state.hopVelocity).toBeGreaterThan(-8.6);
    expect(inAir).toBeGreaterThan(0);
    run(game, 0, 60);
    expect(game.state.hop).toBe(0);
  });

  it('každá vlna nechá aspoň jeden pruh volný', () => {
    const game = createUtek('vlny');
    for (let i = 0; i < 4000; i++) {
      game.step(0);
      // Překážky se stejným x patří k jedné vlně.
      const groups = new Map<number, Set<number>>();
      for (const o of game.state.obstacles) {
        const key = Math.round(o.x);
        if (!groups.has(key)) groups.set(key, new Set());
        groups.get(key)!.add(o.lane);
      }
      for (const lanes of groups.values()) {
        expect(lanes.size).toBeLessThan(LANES);
      }
    }
  });

  it('náraz přiblíží pronásledovatele a sebere tempo', () => {
    const game = createUtek('naraz');
    run(game, 0, 200);
    // Po dvou stech krocích už mohl hráč do něčeho vrazit; pro čistý test
    // stav srovnáme a postavíme si vlastní překážku.
    game.state.hitTicks = 0;
    const chase = game.state.chase;
    const speed = game.state.speed;
    game.state.obstacles = [{ kind: 'bedna', lane: game.state.lane, x: RUNNER_X, w: 36, passed: false }];
    game.step(0);
    expect(game.state.chase).toBeGreaterThan(chase);
    expect(game.state.speed).toBeLessThan(speed);
    expect(game.state.hitTicks).toBeGreaterThan(0);
  });

  it('skok přenese hráče přes bednu', () => {
    const game = createUtek('preskok');
    game.state.hop = 30;
    const chase = game.state.chase;
    game.state.obstacles = [{ kind: 'bedna', lane: game.state.lane, x: RUNNER_X, w: 36, passed: false }];
    game.step(0);
    expect(game.state.chase).toBeLessThanOrEqual(chase);
  });

  it('odměna odsune pronásledovatele', () => {
    const game = createUtek('odmena');
    game.state.chase = 0.6;
    game.state.pickups = [{ lane: game.state.lane, x: RUNNER_X, taken: false }];
    game.step(0);
    expect(game.state.chase).toBeLessThan(0.6);
    expect(game.state.score).toBeGreaterThanOrEqual(150);
  });

  it('dostižení hráče hru ukončí', () => {
    const game = createUtek('konec');
    game.state.chase = 0.99;
    game.state.obstacles = [{ kind: 'zavora', lane: game.state.lane, x: RUNNER_X, w: 24, passed: false }];
    game.step(0);
    expect(game.state.over).toBe(true);
    const score = game.state.score;
    game.step(0);
    expect(game.state.score).toBe(score);
  });
});
