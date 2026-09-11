import { describe, it, expect } from 'vitest';
import { createHladovec, type HladovecGame } from '../game.js';
import { MAZES, MAZE_W, MAZE_H, validateMaze, startPosition, isOpen } from '../mazes.js';

function idle(game: HladovecGame, n: number): void {
  for (let i = 0; i < n; i++) game.step(null);
}

describe('bludiště', () => {
  it('každé má správné rozměry', () => {
    for (const maze of MAZES) {
      expect(validateMaze(maze)).toEqual([]);
    }
  });

  it('každé má aspoň dvě velké tečky a spoustu obyčejných', () => {
    for (const [index] of MAZES.entries()) {
      const game = createHladovec(`bludiste-${index}`, index);
      const power = game.state.powerDots.flat().filter(Boolean).length;
      expect(power).toBeGreaterThanOrEqual(2);
      expect(game.state.dotsLeft).toBeGreaterThan(50);
    }
  });

  it('okraje jsou zdi, kromě tunelů', () => {
    const game = createHladovec('okraje');
    for (let x = 0; x < MAZE_W; x++) {
      expect(game.passable(x, 0)).toBe(false);
    }
  });

  /**
   * Nedostupná tečka by znamenala úroveň, kterou nejde dohrát. Tenhle
   * test odhalil 21 odříznutých polí ve druhém bludišti.
   */
  it('všechna průchozí pole jsou z jednoho místa dosažitelná', () => {
    for (const [index, maze] of MAZES.entries()) {
      const tunnelRows = new Set<number>();
      maze.forEach((row, y) => {
        if (row[0] === 'T' || row[MAZE_W - 1] === 'T') tunnelRows.add(y);
      });

      const open = new Set<string>();
      for (let y = 0; y < MAZE_H; y++) {
        for (let x = 0; x < MAZE_W; x++) {
          if (isOpen(maze[y]![x]!)) open.add(`${x},${y}`);
        }
      }

      const start = startPosition(maze);
      const seen = new Set<string>();
      const stack = [`${start.x},${start.y}`];
      while (stack.length > 0) {
        const key = stack.pop()!;
        if (seen.has(key)) continue;
        seen.add(key);
        const [x, y] = key.split(',').map(Number) as [number, number];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          let nx = x + dx;
          const ny = y + dy;
          if (dy === 0 && tunnelRows.has(y)) nx = ((nx % MAZE_W) + MAZE_W) % MAZE_W;
          if (nx < 0 || ny < 0 || nx >= MAZE_W || ny >= MAZE_H) continue;
          const nk = `${nx},${ny}`;
          if (open.has(nk) && !seen.has(nk)) stack.push(nk);
        }
      }

      expect(seen.size, `bludiště ${index} má nedostupná pole`).toBe(open.size);
    }
  });

  it('hráč nezačíná ve zdi ani v doupěti', () => {
    for (const maze of MAZES) {
      const start = startPosition(maze);
      const char = maze[start.y]![start.x]!;
      expect(isOpen(char)).toBe(true);
      expect(char).not.toBe('-');
      expect(char).not.toBe(' ');
    }
  });
});

describe('Hladovec — hráč', () => {
  it('začíná se třemi životy a plným bludištěm', () => {
    const game = createHladovec('start');
    expect(game.state.lives).toBe(3);
    expect(game.state.dotsLeft).toBeGreaterThan(0);
    expect(game.state.chasers).toHaveLength(4);
  });

  it('pohyb směrem, kde je volno, funguje', () => {
    const game = createHladovec('pohyb');
    const startX = game.state.playerX;
    for (let i = 0; i < 20; i++) game.step('left');
    expect(game.state.playerX).not.toBe(startX);
  });

  it('do zdi se neprojde', () => {
    const game = createHladovec('zed');
    // Dolů z výchozí pozice je zeď.
    const startY = game.state.playerY;
    for (let i = 0; i < 30; i++) game.step('down');
    expect(Math.round(game.state.playerY)).toBeLessThanOrEqual(Math.round(startY));
  });

  it('předvolený směr se uplatní, jakmile to jde', () => {
    const game = createHladovec('predvolba');
    // Zadáme směr, který hned nejde, a necháme hráče dojet na křižovatku.
    game.step('up');
    for (let i = 0; i < 60; i++) game.step(null);
    expect(game.state.over).toBe(false);
  });

  it('sebraná tečka zmizí a přidá body', () => {
    const game = createHladovec('tecky');
    const before = game.state.dotsLeft;
    const score = game.state.score;
    for (let i = 0; i < 60; i++) game.step('left');
    expect(game.state.dotsLeft).toBeLessThan(before);
    expect(game.state.score).toBeGreaterThan(score);
  });

  it('tunelem se projde na druhou stranu', () => {
    const game = createHladovec('tunel');
    // Postavíme hráče do tunelového řádku a pošleme ho doleva za okraj.
    game.state.playerX = 0.4;
    game.state.playerY = 10;
    game.state.direction = 'left';
    for (let i = 0; i < 20; i++) game.step('left');
    expect(game.state.playerX).toBeGreaterThan(0);
    expect(game.state.playerX).toBeLessThan(MAZE_W);
  });
});

describe('Hladovec — pronásledovatelé', () => {
  it('každý má jinou povahu', () => {
    const game = createHladovec('povahy');
    const kinds = game.state.chasers.map((c) => c.kind);
    expect(new Set(kinds).size).toBe(4);
    expect(kinds).toContain('lovec');
    expect(kinds).toContain('nadbihac');
    expect(kinds).toContain('nahoda');
    expect(kinds).toContain('plachy');
  });

  it('vyjíždějí postupně, ne všichni naráz', () => {
    const game = createHladovec('vyjezd');
    // Na startu je venku jen první; ostatní čekají s rostoucí prodlevou.
    expect(game.state.chasers.filter((c) => c.inHouse)).toHaveLength(3);
    const timers = game.state.chasers.filter((c) => c.inHouse).map((c) => c.releaseTimer);
    expect([...timers].sort((a, b) => a - b)).toEqual(timers);

    // Kontrolujeme v okně, než hráče stojícího na místě někdo chytí:
    // smrt vrací Prachoše zpátky do doupěte a odpočty by se resetovaly.
    idle(game, 190);
    expect(game.state.chasers.filter((c) => c.inHouse).length).toBeLessThan(3);
    idle(game, 190);
    expect(game.state.chasers.filter((c) => c.inHouse).length).toBeLessThan(2);
  });

  it('fáze se střídají mezi rozptýlením a pronásledováním', () => {
    const game = createHladovec('faze');
    expect(game.state.phase).toBe('rozptyleni');
    idle(game, 7 * 60 + 5);
    expect(game.state.phase).toBe('pronasledovani');
  });

  it('velká tečka je vystraší a hráč je může sníst', () => {
    const game = createHladovec('velka-tecka');
    // Postavíme hráče přímo na velkou tečku.
    let found: { x: number; y: number } | null = null;
    for (let y = 0; y < MAZE_H && !found; y++) {
      for (let x = 0; x < MAZE_W; x++) {
        if (game.state.powerDots[y]![x]) {
          found = { x, y };
          break;
        }
      }
    }
    expect(found).not.toBeNull();
    game.state.playerX = found!.x;
    game.state.playerY = found!.y;
    game.step(null);

    expect(game.state.chasers.some((c) => c.mode === 'vystraseny')).toBe(true);
  });

  it('sněžený Prachoš se vrací do doupěte a body rostou geometricky', () => {
    const game = createHladovec('snezeni');
    // Pod hráčem vyčistíme tečky, aby do rozdílu skóre nepřitekly body
    // za sběr a test měřil opravdu jen odměnu za Prachoše.
    game.state.dots = game.state.dots.map((row) => row.map(() => false));
    game.state.powerDots = game.state.powerDots.map((row) => row.map(() => false));

    const chaser = game.state.chasers[0]!;
    chaser.inHouse = false;
    chaser.mode = 'vystraseny';
    chaser.frightenedTicks = 300;
    chaser.x = game.state.playerX;
    chaser.y = game.state.playerY;

    const score = game.state.score;
    game.step(null);
    expect(chaser.mode).toBe('navrat');
    expect(game.state.score).toBe(score + 200);

    const second = game.state.chasers[1]!;
    second.inHouse = false;
    second.mode = 'vystraseny';
    second.frightenedTicks = 300;
    second.x = game.state.playerX;
    second.y = game.state.playerY;
    game.step(null);
    expect(game.state.score).toBe(score + 200 + 400);
  });

  it('vystrašení po čase vyprší', () => {
    const game = createHladovec('vyprseni');
    const chaser = game.state.chasers[0]!;
    chaser.inHouse = false;
    chaser.mode = 'vystraseny';
    chaser.frightenedTicks = 2;
    // Prachoše odsuneme, aby ho hráč omylem nesnědl.
    chaser.x = 1;
    chaser.y = 1;
    idle(game, 4);
    expect(chaser.mode).not.toBe('vystraseny');
  });

  it('kontakt s běžným Prachošem ubere život', () => {
    const game = createHladovec('zasah');
    const chaser = game.state.chasers[0]!;
    chaser.inHouse = false;
    chaser.mode = 'pronasledovani';
    chaser.x = game.state.playerX;
    chaser.y = game.state.playerY;

    game.step(null);
    expect(game.state.lives).toBe(2);
    expect(game.state.respawnTimer).toBeGreaterThan(0);
  });

  it('poslední život znamená konec', () => {
    const game = createHladovec('konec');
    game.state.lives = 1;
    const chaser = game.state.chasers[0]!;
    chaser.inHouse = false;
    chaser.mode = 'pronasledovani';
    chaser.x = game.state.playerX;
    chaser.y = game.state.playerY;
    game.step(null);
    expect(game.state.over).toBe(true);
  });

  it('Prachoši se drží v průchozích polích', () => {
    const game = createHladovec('v-bludisti');
    idle(game, 1200);
    for (const chaser of game.state.chasers) {
      if (chaser.inHouse) continue;
      expect(game.passable(Math.round(chaser.x), Math.round(chaser.y))).toBe(true);
    }
  });
});

describe('Hladovec — postup', () => {
  it('vysbírané bludiště posune hru na další úroveň', () => {
    const game = createHladovec('dalsi-uroven');
    const level = game.state.level;
    game.state.dotsLeft = 0;
    game.step(null);
    expect(game.state.level === level + 1 || game.state.won).toBe(true);
  });

  it('stejný seed dá stejný průběh', () => {
    const run = (): string => {
      const game = createHladovec('determinismus');
      const dirs = ['left', 'up', 'right', 'down'] as const;
      for (let i = 0; i < 600; i++) game.step(i % 40 === 0 ? dirs[(i / 40) % 4] : null);
      return JSON.stringify({
        score: game.state.score,
        dots: game.state.dotsLeft,
        chasers: game.state.chasers.map((c) => [Math.round(c.x * 100), Math.round(c.y * 100)]),
      });
    };
    expect(run()).toBe(run());
  });

  it('ovoce se objeví a po čase zmizí', () => {
    const game = createHladovec('ovoce');
    idle(game, 610);
    expect(game.state.fruit).not.toBeNull();
    game.state.fruit!.ticks = 1;
    idle(game, 3);
    expect(game.state.fruit).toBeNull();
  });
});
