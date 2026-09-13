import { describe, it, expect } from 'vitest';
import {
  createSuperSkokan, TILE, LEVEL_TICKS, type SkokanGame,
} from '../game.js';
import { LEVELS, validateLevel } from '../levels.js';
import { BIT } from '../../input-bits.js';

function run(game: SkokanGame, mask: number, ticks: number): void {
  for (let i = 0; i < ticks; i++) game.step(mask);
}

describe('úrovně Super skokana', () => {
  it('mají správný tvar', () => {
    for (const level of LEVELS) expect(validateLevel(level), level.name).toEqual([]);
  });

  it('mají hráče nad pevnou zemí', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const game = createSuperSkokan('start', i);
      run(game, 0, 40);
      expect(game.state.player.onGround, LEVELS[i]!.name).toBe(true);
    }
  });
});

describe('pohyb hráče', () => {
  it('doprava zrychluje a po puštění se zastaví', () => {
    const game = createSuperSkokan('beh');
    const startX = game.state.player.x;
    run(game, BIT.right, 30);
    expect(game.state.player.x).toBeGreaterThan(startX);
    expect(game.state.facing).toBe(1);
    run(game, 0, 30);
    expect(game.state.player.vx).toBe(0);
  });

  it('skok vynese hráče nahoru a gravitace ho vrátí', () => {
    const game = createSuperSkokan('skok');
    run(game, 0, 10);
    const groundY = game.state.player.y;
    game.step(BIT.a);
    expect(game.state.player.y).toBeLessThan(groundY);
    run(game, 0, 120);
    expect(game.state.player.onGround).toBe(true);
  });

  it('držený skok vynese výš než ťuknutí', () => {
    const short = createSuperSkokan('kratky');
    run(short, 0, 10);
    const shortStart = short.state.player.y;
    short.step(BIT.a);
    let shortBest = short.state.player.y;
    for (let i = 0; i < 60; i++) {
      short.step(0);
      shortBest = Math.min(shortBest, short.state.player.y);
    }

    const long = createSuperSkokan('dlouhy');
    run(long, 0, 10);
    long.step(BIT.a);
    let longBest = long.state.player.y;
    for (let i = 0; i < 60; i++) {
      long.step(BIT.a);
      longBest = Math.min(longBest, long.state.player.y);
    }

    expect(shortStart - longBest).toBeGreaterThan(shortStart - shortBest);
  });

  it('skok zmáčknutý těsně před dopadem se provede po dopadu', () => {
    const game = createSuperSkokan('buffer');
    run(game, 0, 10);
    // Kousek nad zemí a bez coyote času: skok teď vyjít nesmí, ale po
    // dopadu ano — o to jde, buffer drží stisk přes pár snímků.
    game.state.player.y -= 12;
    game.state.player.vy = 0;
    game.state.player.onGround = false;
    game.state.coyote = 0;

    game.step(BIT.a);
    expect(game.state.player.vy).toBeGreaterThan(0);

    let jumped = false;
    for (let i = 0; i < 20; i++) {
      game.step(0);
      if (game.state.player.vy < -5) jumped = true;
    }
    expect(jumped).toBe(true);
  });
});

describe('nepřátelé a překážky', () => {
  it('dupnutí nepřítele zabije a hráče odrazí', () => {
    const game = createSuperSkokan('dupnuti');
    const enemy = game.state.enemies[0]!;
    const p = game.state.player;
    p.x = enemy.body.x;
    p.y = enemy.body.y - p.h + 2;
    p.vy = 4;
    game.step(0);
    expect(enemy.alive).toBe(false);
    expect(game.state.player.vy).toBeLessThan(0);
    expect(game.state.score).toBeGreaterThan(0);
  });

  it('náraz do nepřítele zboku stojí život', () => {
    const game = createSuperSkokan('naraz');
    const enemy = game.state.enemies[0]!;
    const lives = game.state.lives;
    game.state.player.x = enemy.body.x;
    game.state.player.y = enemy.body.y;
    game.state.player.vy = 0;
    game.step(0);
    expect(game.state.lives).toBe(lives - 1);
  });

  it('trny stojí život', () => {
    const game = createSuperSkokan('trny', 2);
    const lives = game.state.lives;
    const rows = game.state.rows;
    let found = false;
    for (let ty = 0; ty < rows.length && !found; ty++) {
      const tx = rows[ty]!.indexOf('^');
      if (tx < 0) continue;
      game.state.player.x = tx * TILE + 4;
      game.state.player.y = ty * TILE + TILE - game.state.player.h;
      found = true;
    }
    expect(found).toBe(true);
    game.step(0);
    expect(game.state.lives).toBe(lives - 1);
  });

  it('pád z mapy stojí život', () => {
    const game = createSuperSkokan('pad');
    const lives = game.state.lives;
    game.state.player.y = game.state.height * TILE + 200;
    game.step(0);
    expect(game.state.lives).toBe(lives - 1);
  });

  it('chodec se na hraně otočí a nespadne', () => {
    const game = createSuperSkokan('chodec', 1);
    const walker = game.state.enemies.find((e) => e.kind === 'chodec')!;
    run(game, 0, 400);
    expect(walker.alive).toBe(true);
    expect(walker.body.y).toBeLessThan(game.state.height * TILE);
  });
});

describe('postup hrou', () => {
  it('mince se sbírají a přidávají body', () => {
    const game = createSuperSkokan('mince');
    const coin = game.state.coins[0]!;
    game.state.player.x = coin.x - 8;
    game.state.player.y = coin.y - 10;
    game.step(0);
    expect(coin.taken).toBe(true);
    expect(game.state.score).toBeGreaterThanOrEqual(100);
  });

  it('dotek vlajky dokončí úroveň a pustí další', () => {
    const game = createSuperSkokan('cil');
    game.state.player.x = game.state.goal.x;
    game.state.player.y = game.state.goal.y;
    game.step(0);
    expect(game.state.levelDone).toBe(true);
    run(game, 0, 90);
    expect(game.state.level).toBe(1);
  });

  it('poslední úroveň hru dohraje', () => {
    const game = createSuperSkokan('konec', LEVELS.length - 1);
    game.state.player.x = game.state.goal.x;
    game.state.player.y = game.state.goal.y;
    game.step(0);
    run(game, 0, 90);
    expect(game.state.won).toBe(true);
  });

  it('vypršení času stojí život', () => {
    const game = createSuperSkokan('cas');
    const lives = game.state.lives;
    game.state.ticks = LEVEL_TICKS;
    game.step(0);
    expect(game.state.lives).toBe(lives - 1);
  });

  it('ztráta posledního života ukončí hru', () => {
    const game = createSuperSkokan('konec-zivotu');
    game.state.lives = 1;
    game.state.player.y = game.state.height * TILE + 200;
    game.step(0);
    expect(game.state.over).toBe(true);
  });
});
