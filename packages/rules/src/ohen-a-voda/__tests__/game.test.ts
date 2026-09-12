import { describe, it, expect } from 'vitest';
import { createOhenVoda, TILE, type OhenVodaGame } from '../game.js';
import { LEVELS, validateLevel } from '../levels.js';
import { BIT } from '../../input-bits.js';

function run(game: OhenVodaGame, a: number, b: number, ticks: number): void {
  for (let i = 0; i < ticks; i++) game.step(a, b);
}

/** Postaví hrdinu doprostřed zadané dlaždice. */
function place(game: OhenVodaGame, who: 'ohen' | 'voda', tx: number, ty: number): void {
  const hero = game.state[who];
  hero.body.x = tx * TILE + (TILE - hero.body.w) / 2;
  hero.body.y = ty * TILE + TILE - hero.body.h;
  hero.body.vx = 0;
  hero.body.vy = 0;
}

function findTile(game: OhenVodaGame, char: string): { x: number; y: number } | null {
  for (let ty = 0; ty < game.state.height; ty++) {
    const tx = game.state.rows[ty]!.indexOf(char);
    if (tx >= 0) return { x: tx, y: ty };
  }
  return null;
}

describe('úrovně Ohně a Vody', () => {
  it('mají správný tvar', () => {
    for (const level of LEVELS) expect(validateLevel(level), level.name).toEqual([]);
  });

  it('obě postavy stojí na zemi a nejsou v kaluži', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const game = createOhenVoda('start', i);
      run(game, 0, 0, 40);
      expect(game.state.ohen.body.onGround, LEVELS[i]!.name).toBe(true);
      expect(game.state.voda.body.onGround, LEVELS[i]!.name).toBe(true);
      expect(game.state.failed, LEVELS[i]!.name).toBe(false);
    }
  });
});

describe('dvě postavy', () => {
  it('každá poslouchá svoje tlačítka', () => {
    const game = createOhenVoda('ovladani');
    run(game, 0, 0, 10);
    const ohenX = game.state.ohen.body.x;
    const vodaX = game.state.voda.body.x;
    run(game, BIT.right, 0, 20);
    expect(game.state.ohen.body.x).toBeGreaterThan(ohenX);
    expect(game.state.voda.body.x).toBe(vodaX);
  });

  it('Oheň projde ohnivou kaluží, Voda v ní zemře', () => {
    const fire = createOhenVoda('ohen');
    const pool = findTile(fire, 'f')!;
    place(fire, 'ohen', pool.x, pool.y);
    fire.step(0, 0);
    expect(fire.state.failed).toBe(false);

    const water = createOhenVoda('voda');
    place(water, 'voda', pool.x, pool.y);
    water.step(0, 0);
    expect(water.state.failed).toBe(true);
    expect(water.state.voda.dead).toBe(true);
  });

  it('žíravina zabije obě', () => {
    for (const who of ['ohen', 'voda'] as const) {
      const game = createOhenVoda('zaravina', 1);
      const pool = findTile(game, 'x')!;
      place(game, who, pool.x, pool.y);
      game.step(0, 0);
      expect(game.state.failed, who).toBe(true);
    }
  });

  it('po neúspěchu se úroveň postaví znovu', () => {
    const game = createOhenVoda('restart');
    const pool = findTile(game, 'f')!;
    place(game, 'voda', pool.x, pool.y);
    game.step(0, 0);
    expect(game.state.failed).toBe(true);
    run(game, 0, 0, 80);
    expect(game.state.failed).toBe(false);
    expect(game.state.voda.dead).toBe(false);
  });
});

describe('brána a tlačítko', () => {
  it('brána je zavřená, dokud na tlačítko nikdo nestoupne', () => {
    const game = createOhenVoda('brana', 2);
    const gate = findTile(game, 'G')!;
    expect(game.grid.solid(gate.x, gate.y)).toBe(true);

    const button = findTile(game, 'B')!;
    place(game, 'ohen', button.x, button.y);
    game.step(0, 0);
    expect(game.state.gateOpen).toBe(true);
    expect(game.grid.solid(gate.x, gate.y)).toBe(false);
  });

  it('po sestoupení z tlačítka se brána zase zavře', () => {
    const game = createOhenVoda('brana-zpet', 2);
    const button = findTile(game, 'B')!;
    place(game, 'ohen', button.x, button.y);
    game.step(0, 0);
    expect(game.state.gateOpen).toBe(true);
    place(game, 'ohen', 1, 1);
    game.step(0, 0);
    expect(game.state.gateOpen).toBe(false);
  });
});

describe('dokončení úrovně', () => {
  it('sólo to nejde: musí dojít obě postavy', () => {
    const game = createOhenVoda('sam');
    const door = findTile(game, 'D')!;
    place(game, 'ohen', door.x, door.y);
    game.step(0, 0);
    expect(game.state.ohen.atDoor).toBe(true);
    expect(game.state.levelDone).toBe(false);
  });

  it('obě ve dveřích úroveň dokončí a pustí další', () => {
    const game = createOhenVoda('spolu');
    const fireDoor = findTile(game, 'D')!;
    const waterDoor = findTile(game, 'E')!;
    place(game, 'ohen', fireDoor.x, fireDoor.y);
    place(game, 'voda', waterDoor.x, waterDoor.y);
    game.step(0, 0);
    expect(game.state.levelDone).toBe(true);
    expect(game.state.score).toBeGreaterThanOrEqual(500);
    run(game, 0, 0, 90);
    expect(game.state.level).toBe(1);
  });

  it('poslední úroveň hru dohraje', () => {
    const game = createOhenVoda('konec', LEVELS.length - 1);
    const fireDoor = findTile(game, 'D')!;
    const waterDoor = findTile(game, 'E')!;
    place(game, 'ohen', fireDoor.x, fireDoor.y);
    place(game, 'voda', waterDoor.x, waterDoor.y);
    game.step(0, 0);
    run(game, 0, 0, 90);
    expect(game.state.won).toBe(true);
  });

  it('drahokam sebere jen ta správná postava', () => {
    const game = createOhenVoda('kameny');
    const ruby = game.state.gems.find((g) => g.kind === 'ohen')!;
    place(game, 'voda', Math.floor(ruby.x / TILE), Math.floor(ruby.y / TILE));
    game.step(0, 0);
    expect(ruby.taken).toBe(false);

    place(game, 'ohen', Math.floor(ruby.x / TILE), Math.floor(ruby.y / TILE));
    game.step(0, 0);
    expect(ruby.taken).toBe(true);
    expect(game.state.score).toBeGreaterThanOrEqual(100);
  });
});
