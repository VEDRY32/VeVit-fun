import { describe, it, expect } from 'vitest';
import { createLovecUzemi, GRID_W, GRID_H, WIN_RATIO, type LovecGame } from '../game.js';
import { BIT } from '../../input-bits.js';

function run(game: LovecGame, mask: number, ticks: number): void {
  for (let i = 0; i < ticks; i++) game.step(mask);
}

const filledCount = (game: LovecGame): number =>
  game.state.cells.filter((c) => c === 'zabrano').length;

describe('Lovec území', () => {
  it('začíná se zabraným okrajem a hráčem na něm', () => {
    const game = createLovecUzemi('start');
    expect(game.cellAt(0, 0)).toBe('zabrano');
    expect(game.cellAt(GRID_W - 1, GRID_H - 1)).toBe('zabrano');
    expect(game.cellAt(game.state.player.x, game.state.player.y)).toBe('zabrano');
    expect(game.state.filled).toBeGreaterThan(0);
    expect(game.state.filled).toBeLessThan(WIN_RATIO);
  });

  it('stejný seed dá stejné rozestavení nepřátel', () => {
    const a = createLovecUzemi('shoda');
    const b = createLovecUzemi('shoda');
    expect(a.state.enemies).toEqual(b.state.enemies);
  });

  it('krok do volné plochy nechá stopu', () => {
    const game = createLovecUzemi('stopa');
    run(game, BIT.down, 6);
    expect(game.state.trail.length).toBeGreaterThan(0);
    const first = game.state.trail[0]!;
    expect(game.cellAt(first.x, first.y)).toBe('stopa');
  });

  it('návrat na zabranou plochu stopu uzavře a přidá body', () => {
    const game = createLovecUzemi('uzavreni');
    // Dolů, doprava a zase nahoru: uzavře se pruh u horního okraje.
    run(game, BIT.down, 15);
    run(game, BIT.right, 30);
    run(game, BIT.up, 20);
    expect(game.state.trail.length).toBe(0);
    expect(game.state.score).toBeGreaterThan(0);
    expect(filledCount(game)).toBeGreaterThan(2 * (GRID_W + GRID_H));
  });

  it('šlápnutí do vlastní stopy stojí život a stopa se smaže', () => {
    const game = createLovecUzemi('sebevrazda');
    const px = 10;
    const py = 10;
    game.state.player = { x: px, y: py };
    // Stopa přímo vlevo od hráče.
    game.state.cells[game.index(px - 1, py)] = 'stopa';
    game.state.trail = [{ x: px - 1, y: py }];
    const lives = game.state.lives;

    run(game, BIT.left, 6);

    expect(game.state.lives).toBe(lives - 1);
    expect(game.state.trail).toEqual([]);
    expect(game.cellAt(px - 1, py)).toBe('volno');
    expect(game.state.respawnTimer).toBeGreaterThan(0);
  });

  it('nepřítel se odráží uvnitř volné plochy a ven nevyleze', () => {
    const game = createLovecUzemi('odrazy');
    for (let i = 0; i < 600; i++) game.step(0);
    for (const enemy of game.state.enemies) {
      if (enemy.kind !== 'volny') continue;
      expect(game.cellAt(Math.floor(enemy.x), Math.floor(enemy.y))).not.toBe('zabrano');
    }
  });

  it('ztráta všech životů ukončí hru', () => {
    const game = createLovecUzemi('konec');
    game.state.lives = 1;
    // Postavíme nepřítele přímo na hráče.
    game.state.enemies[0]!.x = game.state.player.x + 0.5;
    game.state.enemies[0]!.y = game.state.player.y + 0.5;
    game.step(0);
    expect(game.state.over).toBe(true);
  });

  it('dost zabrané plochy úroveň dokončí', () => {
    const game = createLovecUzemi('uroven');
    // Zabereme vše kromě jednoho pole.
    for (let i = 0; i < game.state.cells.length; i++) game.state.cells[i] = 'zabrano';
    game.state.cells[game.index(5, 5)] = 'volno';
    game.state.trail = [{ x: 5, y: 5 }];
    game.state.cells[game.index(5, 5)] = 'stopa';
    game.state.player = { x: 5, y: 5 };
    game.state.direction = 'left';
    run(game, BIT.left, 6);
    expect(game.state.levelDone).toBe(true);
  });
});
