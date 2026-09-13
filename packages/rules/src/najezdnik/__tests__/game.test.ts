import { describe, it, expect } from 'vitest';
import { createNajezdnik, TILE, MAX_HEALTH, type NajezdnikGame } from '../game.js';
import { LEVELS, validateLevel } from '../levels.js';
import { BIT } from '../../input-bits.js';

function run(game: NajezdnikGame, mask: number, ticks: number): void {
  for (let i = 0; i < ticks; i++) game.step(mask);
}

describe('úrovně Nájezdníka', () => {
  it('mají správný tvar', () => {
    for (const level of LEVELS) expect(validateLevel(level), level.name).toEqual([]);
  });

  it('hráč startuje na zemi a s plným životem', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const game = createNajezdnik('start', i);
      run(game, 0, 30);
      expect(game.state.player.onGround, LEVELS[i]!.name).toBe(true);
      expect(game.state.health).toBe(MAX_HEALTH);
    }
  });
});

describe('střelba', () => {
  it('výstřel letí po směru pohledu a ubírá náboje', () => {
    const game = createNajezdnik('strelba');
    run(game, 0, 10);
    const ammo = game.state.ammo;
    game.step(BIT.a);
    expect(game.state.ammo).toBe(ammo - 1);
    const shot = game.state.shots.find((s) => s.fromPlayer)!;
    expect(shot.vx).toBeGreaterThan(0);
    expect(shot.vy).toBe(0);
  });

  it('se šipkou nahoru se pálí vzhůru', () => {
    const game = createNajezdnik('nahoru');
    run(game, 0, 10);
    game.step(BIT.a | BIT.up);
    const shot = game.state.shots.find((s) => s.fromPlayer)!;
    expect(shot.vy).toBeLessThan(0);
    expect(shot.vx).toBe(0);
  });

  it('bez nábojů se nestřílí', () => {
    const game = createNajezdnik('prazdno');
    run(game, 0, 10);
    game.state.ammo = 0;
    run(game, BIT.a, 30);
    expect(game.state.shots.filter((s) => s.fromPlayer)).toHaveLength(0);
  });

  it('zásah nepřítele ho zabije a přidá body', () => {
    const game = createNajezdnik('zasah');
    run(game, 0, 10);
    const enemy = game.state.enemies[0]!;
    enemy.hp = 1;
    const score = game.state.score;
    // Doprostřed nepřítele: ten se v témž kroku o kousek posune a na kraji
    // těla by mu střela utekla.
    game.state.shots.push({
      x: enemy.body.x + enemy.body.w / 2,
      y: enemy.body.y + enemy.body.h / 2,
      vx: 0, vy: 0, fromPlayer: true,
    });
    game.step(0);
    expect(enemy.alive).toBe(false);
    expect(game.state.score).toBeGreaterThan(score);
  });

  it('střela se zastaví o zeď', () => {
    const game = createNajezdnik('zed');
    run(game, 0, 10);
    // Doprostřed dlaždice podlahy.
    game.state.shots = [{
      x: game.state.player.x,
      y: (game.state.height - 2) * TILE + TILE / 2,
      vx: 0, vy: 0, fromPlayer: true,
    }];
    game.step(0);
    expect(game.state.shots).toHaveLength(0);
  });
});

describe('poškození', () => {
  it('zásah ubere život a chvíli chrání před dalším', () => {
    const game = createNajezdnik('bolest');
    run(game, 0, 10);
    const health = game.state.health;
    const p = game.state.player;
    game.state.shots.push({ x: p.x + 4, y: p.y + 4, vx: 0, vy: 0, fromPlayer: false });
    game.step(0);
    expect(game.state.health).toBe(health - 1);
    expect(game.state.hurtTicks).toBeGreaterThan(0);

    game.state.shots.push({ x: p.x + 4, y: p.y + 4, vx: 0, vy: 0, fromPlayer: false });
    game.step(0);
    expect(game.state.health).toBe(health - 1);
  });

  it('vynulovaný život ukončí hru', () => {
    const game = createNajezdnik('konec');
    run(game, 0, 10);
    game.state.health = 1;
    const p = game.state.player;
    game.state.shots.push({ x: p.x + 4, y: p.y + 4, vx: 0, vy: 0, fromPlayer: false });
    game.step(0);
    expect(game.state.over).toBe(true);
  });

  it('pád z mapy hru ukončí', () => {
    const game = createNajezdnik('pad');
    game.state.player.y = game.state.height * TILE + 200;
    game.step(0);
    expect(game.state.over).toBe(true);
  });

  it('trny ubírají dva životy', () => {
    const game = createNajezdnik('trny', 1);
    run(game, 0, 10);
    const health = game.state.health;
    let found = false;
    for (let ty = 0; ty < game.state.height && !found; ty++) {
      const tx = game.state.rows[ty]!.indexOf('^');
      if (tx < 0) continue;
      game.state.player.x = tx * TILE + 4;
      game.state.player.y = ty * TILE + TILE - game.state.player.h;
      found = true;
    }
    expect(found).toBe(true);
    game.step(0);
    expect(game.state.health).toBe(health - 2);
  });
});

describe('postup', () => {
  it('lékárnička doplní život, náboje zvýší zásobu', () => {
    const game = createNajezdnik('sber');
    run(game, 0, 10);
    game.state.health = 2;
    const medkit = game.state.pickups.find((p) => p.kind === 'lekarna')!;
    game.state.player.x = medkit.x - 8;
    game.state.player.y = medkit.y - 10;
    game.step(0);
    expect(medkit.taken).toBe(true);
    expect(game.state.health).toBe(4);

    const ammoBox = game.state.pickups.find((p) => p.kind === 'naboje')!;
    const ammo = game.state.ammo;
    game.state.player.x = ammoBox.x - 8;
    game.state.player.y = ammoBox.y - 10;
    game.step(0);
    expect(game.state.ammo).toBeGreaterThan(ammo);
  });

  it('východ dokončí úroveň a pustí další', () => {
    const game = createNajezdnik('vychod');
    game.state.player.x = game.state.exit.x;
    game.state.player.y = game.state.exit.y;
    game.step(0);
    expect(game.state.levelDone).toBe(true);
    run(game, 0, 90);
    expect(game.state.level).toBe(1);
  });

  it('poslední úroveň hru dohraje', () => {
    const game = createNajezdnik('konec-hry', LEVELS.length - 1);
    game.state.player.x = game.state.exit.x;
    game.state.player.y = game.state.exit.y;
    game.step(0);
    run(game, 0, 90);
    expect(game.state.won).toBe(true);
  });
});
