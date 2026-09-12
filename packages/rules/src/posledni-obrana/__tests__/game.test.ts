import { describe, it, expect } from 'vitest';
import {
  createPosledniObrana, WORLD_W, WORLD_H, TURRET_X, BARRICADE_Y,
  type ObranaGame,
} from '../game.js';
import { BIT } from '../../input-bits.js';

const UP = -Math.PI / 2;

function run(game: ObranaGame, mask: number, ticks: number, aim = UP): void {
  for (let i = 0; i < ticks; i++) game.step(mask, aim);
}

describe('Poslední obrana', () => {
  it('začíná první vlnou a plnou barikádou', () => {
    const game = createPosledniObrana('start');
    expect(game.state.wave).toBe(1);
    expect(game.state.barricade).toBe(game.state.maxBarricade);
    expect(game.state.offers).toEqual([]);
  });

  it('stejný seed dá stejnou vlnu', () => {
    const play = (): string => {
      const game = createPosledniObrana('shoda');
      run(game, 0, 400);
      return JSON.stringify(game.state.enemies.map((e) => [e.kind, Math.round(e.x), Math.round(e.y)]));
    };
    expect(play()).toBe(play());
  });

  it('nepřátelé přicházejí shora a míří k barikádě', () => {
    const game = createPosledniObrana('prichod');
    run(game, 0, 200);
    expect(game.state.enemies.length).toBeGreaterThan(0);
    for (const enemy of game.state.enemies) {
      expect(enemy.x).toBeGreaterThanOrEqual(0);
      expect(enemy.x).toBeLessThanOrEqual(WORLD_W);
      expect(enemy.y).toBeLessThan(WORLD_H);
    }
  });

  it('držená střelba vyprázdní zásobník a spustí nabíjení', () => {
    const game = createPosledniObrana('strelba');
    const magazine = game.state.magazine;
    run(game, BIT.a, magazine * 14);
    expect(game.state.ammo).toBe(0);
    expect(game.state.reloadTimer).toBeGreaterThan(0);
    run(game, 0, 80);
    expect(game.state.ammo).toBe(magazine);
  });

  it('zásah nepřítele ho zraní a smrt přidá body', () => {
    const game = createPosledniObrana('zasah');
    run(game, 0, 120);
    const enemy = game.state.enemies[0]!;
    enemy.hp = 1;
    enemy.x = TURRET_X;
    enemy.y = 200;
    const score = game.state.score;
    // Střílíme přímo nahoru na nepřítele nad hlavní.
    run(game, BIT.a, 40);
    expect(game.state.score).toBeGreaterThan(score);
  });

  it('nepřítel u barikády ubere život a zmizí', () => {
    const game = createPosledniObrana('barikada');
    run(game, 0, 120);
    const enemy = game.state.enemies[0]!;
    enemy.kind = 'bezec';
    enemy.y = BARRICADE_Y;
    const before = game.state.barricade;
    game.step(0, UP);
    expect(game.state.barricade).toBeLessThan(before);
    expect(game.state.enemies).not.toContain(enemy);
  });

  it('spadlá barikáda hru ukončí', () => {
    const game = createPosledniObrana('konec');
    game.state.barricade = 1;
    run(game, 0, 120);
    const enemy = game.state.enemies[0]!;
    enemy.y = BARRICADE_Y;
    enemy.kind = 'bezec';
    game.step(0, UP);
    expect(game.state.over).toBe(true);
    const score = game.state.score;
    game.step(BIT.a, UP);
    expect(game.state.score).toBe(score);
  });

  it('po vybití vlny nabídne tři různá vylepšení', () => {
    const game = createPosledniObrana('vlna');
    game.state.toSpawn = 0;
    game.state.enemies = [];
    game.step(0, UP);
    expect(game.state.offers).toHaveLength(3);
    expect(new Set(game.state.offers.map((o) => o.kind)).size).toBe(3);
  });

  it('vylepšení se projeví a pustí další vlnu', () => {
    const game = createPosledniObrana('vylepseni');
    game.state.toSpawn = 0;
    game.state.enemies = [];
    game.step(0, UP);

    const offers = [...game.state.offers];
    const before = {
      fireInterval: game.state.fireInterval,
      damage: game.state.damage,
      magazine: game.state.magazine,
      maxBarricade: game.state.maxBarricade,
    };
    const wave = game.state.wave;
    expect(game.choose(0)).toBe(true);
    expect(game.state.wave).toBe(wave + 1);
    expect(game.state.offers).toEqual([]);

    const kind = offers[0]!.kind;
    if (kind === 'palba') expect(game.state.fireInterval).toBeLessThan(before.fireInterval);
    if (kind === 'sila') expect(game.state.damage).toBeGreaterThan(before.damage);
    if (kind === 'zasobnik') expect(game.state.magazine).toBeGreaterThan(before.magazine);
    if (kind === 'oprava') expect(game.state.maxBarricade).toBeGreaterThan(before.maxBarricade);
  });

  it('mezi vlnami se nestřílí', () => {
    const game = createPosledniObrana('pauza');
    game.state.toSpawn = 0;
    game.state.enemies = [];
    game.step(0, UP);
    const ammo = game.state.ammo;
    game.state.offers = [{ kind: 'sila', label: 'Silnější náboje' }];
    game.step(BIT.a, UP);
    expect(game.state.ammo).toBe(ammo);
  });

  it('plivač se zastaví v půli pole a pálí po barikádě', () => {
    const game = createPosledniObrana('plivac');
    game.state.enemies = [{
      kind: 'plivac', x: TURRET_X, y: WORLD_H * 0.42,
      hp: 3, maxHp: 3, speed: 0.3, cooldown: 1,
    }];
    game.state.toSpawn = 1;
    game.step(0, UP);
    expect(game.state.shots.some((s) => !s.fromPlayer)).toBe(true);
  });
});
