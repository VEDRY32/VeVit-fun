import { describe, it, expect } from 'vitest';
import {
  createPoulicniBitka, WORLD_W, STREET_TOP, STREET_BOTTOM, DEPTH_TOLERANCE, FIGHTER_W,
  type BitkaGame,
} from '../game.js';
import { BIT } from '../../input-bits.js';

function run(game: BitkaGame, mask: number, ticks: number): void {
  for (let i = 0; i < ticks; i++) game.step(mask);
}

/**
 * Postaví nepřítele těsně vpravo od hráče, ve stejné hloubce a čelem
 * k němu. Směr se musí nastavit ručně: nepřítel si ho volí jen v kroku,
 * ve kterém zrovna neútočí.
 */
function enemyInFront(game: BitkaGame) {
  run(game, 0, 120);
  const enemy = game.state.enemies[0]!;
  const p = game.state.player;
  enemy.x = p.x + FIGHTER_W + 4;
  enemy.y = p.y;
  enemy.facing = -1;
  enemy.hurtTicks = 0;
  enemy.attackTicks = 0;
  p.facing = 1;
  p.hurtTicks = 0;
  return enemy;
}

describe('Pouliční bitka', () => {
  it('začíná první vlnou a plným zdravím', () => {
    const game = createPoulicniBitka('start');
    expect(game.state.wave).toBe(1);
    expect(game.state.player.health).toBe(game.state.player.maxHealth);
  });

  it('stejný seed dá stejnou vlnu', () => {
    const play = (): string => {
      const game = createPoulicniBitka('shoda');
      run(game, 0, 400);
      return JSON.stringify(game.state.enemies.map((e) => [e.kind, Math.round(e.x), Math.round(e.y)]));
    };
    expect(play()).toBe(play());
  });

  it('hráč se hýbe po ulici i do hloubky a nevyjde z ní', () => {
    const game = createPoulicniBitka('pohyb');
    const start = { ...game.state.player };
    run(game, BIT.right, 20);
    expect(game.state.player.x).toBeGreaterThan(start.x);
    expect(game.state.player.facing).toBe(1);

    run(game, BIT.up, 200);
    expect(game.state.player.y).toBeGreaterThanOrEqual(STREET_TOP);
    run(game, BIT.down, 200);
    expect(game.state.player.y).toBeLessThanOrEqual(STREET_BOTTOM);
    run(game, BIT.right, 400);
    expect(game.state.player.x).toBeLessThanOrEqual(WORLD_W);
  });

  it('pěst i kop mají úder a kop delší dosah', () => {
    const punch = createPoulicniBitka('pest');
    punch.step(BIT.a);
    const punchBox = punch.attackBox(punch.state.player)!;
    expect(punchBox).not.toBeNull();

    const kick = createPoulicniBitka('kop');
    kick.step(BIT.b);
    const kickBox = kick.attackBox(kick.state.player)!;
    expect(kickBox.w).toBeGreaterThan(punchBox.w);
  });

  it('rána platí jen ve stejné hloubce', () => {
    const daleko = createPoulicniBitka('hloubka');
    const enemy = enemyInFront(daleko);
    enemy.y = daleko.state.player.y + DEPTH_TOLERANCE + 20;
    const health = enemy.health;
    daleko.step(BIT.a);
    expect(enemy.health).toBe(health);

    const blizko = createPoulicniBitka('hloubka2');
    const enemy2 = enemyInFront(blizko);
    const health2 = enemy2.health;
    blizko.step(BIT.a);
    expect(enemy2.health).toBeLessThan(health2);
  });

  it('zabitý nepřítel zmizí a přidá body', () => {
    const game = createPoulicniBitka('zabiti');
    const enemy = enemyInFront(game);
    enemy.health = 1;
    const score = game.state.score;
    game.step(BIT.a);
    expect(game.state.enemies).not.toContain(enemy);
    expect(game.state.score).toBeGreaterThan(score);
  });

  it('zásahy za sebou zvyšují kombo, ztráta ho shodí', () => {
    const game = createPoulicniBitka('kombo');
    const enemy = enemyInFront(game);
    enemy.health = 50;
    game.step(BIT.a);
    expect(game.state.combo).toBeGreaterThan(0);

    // Rána od nepřítele kombo shodí.
    game.state.player.hurtTicks = 0;
    enemy.attackTicks = 6;
    game.step(0);
    expect(game.state.combo).toBe(0);
  });

  it('vynulované zdraví hru ukončí', () => {
    const game = createPoulicniBitka('konec');
    const enemy = enemyInFront(game);
    game.state.player.health = 1;
    enemy.attackTicks = 6;
    game.step(0);
    expect(game.state.over).toBe(true);
  });

  it('vybitá vlna pustí další a trochu doplní zdraví', () => {
    const game = createPoulicniBitka('vlna');
    run(game, 0, 60);
    game.state.player.health = 4;
    game.state.toSpawn = 0;
    game.state.enemies = [];
    const wave = game.state.wave;
    game.step(0);
    expect(game.state.wave).toBe(wave + 1);
    expect(game.state.player.health).toBe(6);
  });

  it('zásah na chvíli chrání před dalším', () => {
    const game = createPoulicniBitka('ochrana');
    const enemy = enemyInFront(game);
    const health = game.state.player.health;
    enemy.attackTicks = 8;
    game.step(0);
    expect(game.state.player.health).toBe(health - 1);
    enemy.attackTicks = 8;
    game.step(0);
    expect(game.state.player.health).toBe(health - 1);
  });
});
