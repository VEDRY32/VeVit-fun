import { describe, it, expect } from 'vitest';
import {
  createInvaze, FIELD_W, FIELD_H, PLAYER_Y, PLAYER_W,
  FORMATION_COLS, FORMATION_ROWS, SHIELD_COLS, SHIELD_ROWS, SHIELD_Y, SHIELD_CELL,
  type InvazeGame,
} from '../game.js';

function idle(game: InvazeGame, n: number): void {
  for (let i = 0; i < n; i++) game.step(false, false, false);
}

describe('Invaze — start', () => {
  it('má plnou formaci a tři životy', () => {
    const game = createInvaze('start');
    expect(game.aliveCount()).toBe(FORMATION_COLS * FORMATION_ROWS);
    expect(game.state.lives).toBe(3);
    expect(game.state.wave).toBe(1);
  });

  it('má čtyři kryty s vykrojeným spodkem', () => {
    const game = createInvaze('kryty');
    expect(game.state.shields).toHaveLength(4);
    for (const shield of game.state.shields) {
      expect(shield.cells).toHaveLength(SHIELD_ROWS);
      expect(shield.cells[0]).toHaveLength(SHIELD_COLS);
      // Horní řada je plná, spodní má uprostřed díru.
      expect(shield.cells[0]!.every(Boolean)).toBe(true);
      expect(shield.cells[SHIELD_ROWS - 1]!.some((cell) => !cell)).toBe(true);
    }
  });

  it('stejný seed dá stejný průběh', () => {
    const snapshot = (seed: string): string => {
      const game = createInvaze(seed);
      for (let i = 0; i < 400; i++) game.step(i % 7 < 3, i % 11 < 4, i % 13 === 0);
      return JSON.stringify({
        score: game.state.score, alive: game.aliveCount(),
        x: Math.round(game.state.playerX), shots: game.state.shots.length,
      });
    };
    expect(snapshot('determinismus')).toBe(snapshot('determinismus'));
  });
});

describe('Invaze — hráč', () => {
  it('pohyb doleva a doprava mění pozici', () => {
    const game = createInvaze('pohyb');
    const start = game.state.playerX;
    game.step(true, false, false);
    expect(game.state.playerX).toBeLessThan(start);
    game.step(false, true, false);
    game.step(false, true, false);
    expect(game.state.playerX).toBeGreaterThan(start - 4);
  });

  it('loď nevyjede mimo pole', () => {
    const game = createInvaze('meze');
    for (let i = 0; i < 300; i++) game.step(true, false, false);
    expect(game.state.playerX).toBeGreaterThanOrEqual(PLAYER_W / 2);
    for (let i = 0; i < 600; i++) game.step(false, true, false);
    expect(game.state.playerX).toBeLessThanOrEqual(FIELD_W - PLAYER_W / 2);
  });

  it('naráz letí jen jedna střela hráče', () => {
    const game = createInvaze('jedna-strela');
    for (let i = 0; i < 40; i++) {
      game.step(false, false, true);
      expect(game.state.shots.filter((s) => s.fromPlayer).length).toBeLessThanOrEqual(1);
    }
  });

  it('zásah hráče ubere život a vyčistí střely', () => {
    const game = createInvaze('zasah');
    game.state.shots = [{ x: game.state.playerX, y: PLAYER_Y + 2, vy: 3, fromPlayer: false }];
    game.step(false, false, false);
    expect(game.state.lives).toBe(2);
    expect(game.state.shots).toHaveLength(0);
    expect(game.state.respawnTimer).toBeGreaterThan(0);
  });

  it('poslední život znamená konec', () => {
    const game = createInvaze('konec');
    game.state.lives = 1;
    game.state.shots = [{ x: game.state.playerX, y: PLAYER_Y + 2, vy: 3, fromPlayer: false }];
    game.step(false, false, false);
    expect(game.state.over).toBe(true);
  });
});

describe('Invaze — formace', () => {
  it('formace se pohybuje do strany a u kraje sestoupí', () => {
    const game = createInvaze('formace');
    const startY = game.state.formationY;
    let bounced = false;
    for (let i = 0; i < 2000 && !bounced; i++) {
      idle(game, 1);
      if (game.state.formationY > startY) bounced = true;
    }
    expect(bounced).toBe(true);
  });

  it('formace zrychluje, jak nepřátel ubývá', () => {
    const game = createInvaze('rychlost');
    // Změříme, kolik kroků trvá jeden posun při plné a při skoro prázdné formaci.
    const measure = (): number => {
      const x = game.state.formationX;
      const y = game.state.formationY;
      let ticks = 0;
      while (ticks < 200 && game.state.formationX === x && game.state.formationY === y) {
        idle(game, 1);
        ticks++;
      }
      return ticks;
    };
    const slow = measure();

    for (const enemy of game.state.enemies.slice(0, -3)) enemy.alive = false;
    const fast = measure();
    expect(fast).toBeLessThan(slow);
  });

  it('formace u země hru ukončí', () => {
    const game = createInvaze('zeme');
    game.state.formationY = PLAYER_Y;
    idle(game, 60);
    expect(game.state.over).toBe(true);
  });

  it('vyčištěná vlna spustí další a přidá body', () => {
    const game = createInvaze('vlna');
    const score = game.state.score;
    for (const enemy of game.state.enemies) enemy.alive = false;
    idle(game, 1);
    expect(game.state.wave).toBe(2);
    expect(game.state.score).toBeGreaterThan(score);
    expect(game.aliveCount()).toBe(FORMATION_COLS * FORMATION_ROWS);
  });

  it('vyšší vlny přinesou odolnější typy', () => {
    const game = createInvaze('typy');
    for (let wave = 0; wave < 3; wave++) {
      for (const enemy of game.state.enemies) enemy.alive = false;
      idle(game, 1);
    }
    expect(game.state.wave).toBe(4);
    expect(game.state.enemies.some((e) => e.kind === 'stitovy')).toBe(true);
  });

  it('štítový nepřítel snese dva zásahy', () => {
    const game = createInvaze('stit');
    const enemy = game.state.enemies[0]!;
    enemy.kind = 'stitovy';
    enemy.hp = 2;
    const rect = game.enemyRect(enemy);

    game.state.shots = [{ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, vy: -8, fromPlayer: true }];
    game.step(false, false, false);
    expect(enemy.alive).toBe(true);

    game.state.shots = [{ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, vy: -8, fromPlayer: true }];
    game.step(false, false, false);
    expect(enemy.alive).toBe(false);
  });
});

describe('Invaze — kryty', () => {
  it('střela vykousne do krytu díru', () => {
    const game = createInvaze('kryt-diry');
    const shield = game.state.shields[0]!;
    const before = shield.cells.flat().filter(Boolean).length;

    // Střela se v kroku nejdřív posune a teprve pak se testuje kolize,
    // takže startovní pozice musí být o kus níž, než kam má dopadnout.
    game.state.shots = [{
      x: shield.x + SHIELD_CELL * 2,
      y: SHIELD_Y + SHIELD_CELL * 3,
      vy: -8,
      fromPlayer: true,
    }];
    game.step(false, false, false);

    const after = shield.cells.flat().filter(Boolean).length;
    expect(after).toBeLessThan(before);
    // Střela se krytem zastavila.
    expect(game.state.shots).toHaveLength(0);
  });

  it('střela projde místem, kde už je díra', () => {
    const game = createInvaze('kryt-prostup');
    const shield = game.state.shields[0]!;
    for (const row of shield.cells) row.fill(false);

    game.state.shots = [{
      x: shield.x + SHIELD_CELL * 3,
      y: SHIELD_Y + SHIELD_CELL * 2,
      vy: -8,
      fromPlayer: true,
    }];
    game.step(false, false, false);
    expect(game.state.shots).toHaveLength(1);
  });

  it('nová vlna kryty obnoví', () => {
    const game = createInvaze('kryt-obnova');
    for (const row of game.state.shields[0]!.cells) row.fill(false);
    for (const enemy of game.state.enemies) enemy.alive = false;
    idle(game, 1);
    expect(game.state.shields[0]!.cells.flat().some(Boolean)).toBe(true);
  });
});

describe('Invaze — talíř', () => {
  it('zasažený talíř dá bonus a zmizí', () => {
    const game = createInvaze('talir');
    game.state.saucer = { x: 200, vx: 2.2, active: true };
    const score = game.state.score;
    game.state.shots = [{ x: 200, y: 50, vy: -8, fromPlayer: true }];
    game.step(false, false, false);
    expect(game.state.saucer.active).toBe(false);
    expect(game.state.score).toBe(score + 150);
  });

  it('talíř po přeletu zmizí sám', () => {
    const game = createInvaze('talir-odlet');
    game.state.saucer = { x: FIELD_W + 30, vx: 2.2, active: true };
    idle(game, 10);
    expect(game.state.saucer.active).toBe(false);
  });
});
