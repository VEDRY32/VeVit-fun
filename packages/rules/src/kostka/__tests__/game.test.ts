import { describe, it, expect } from 'vitest';
import { createKostka, FALL_TICKS, type KostkaGame, type Dir } from '../game.js';
import { LEVELS, validateLevel } from '../levels.js';
import { BIT } from '../../input-bits.js';

/** Dojede rozehraný pád, aby se úroveň vyhodnotila. */
function settle(game: KostkaGame): void {
  for (let i = 0; i <= FALL_TICKS; i++) game.step(0);
}

function play(game: KostkaGame, moves: Dir[]): void {
  for (const dir of moves) game.move(dir);
}

describe('úrovně Kostky', () => {
  it('mají správný tvar', () => {
    for (const level of LEVELS) {
      expect(validateLevel(level), level.name).toEqual([]);
    }
  });

  it('mají start i cíl na pevné dlaždici', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const game = createKostka('tvar', i);
      const start = game.blockCells()[0]!;
      expect(game.tileAt(start.x, start.y), LEVELS[i]!.name).toBe('pevna');
    }
  });
});

describe('převalování', () => {
  it('stojící kostka se doprava položí a zabere dvě pole', () => {
    const game = createKostka('valeni');
    const { x, y } = game.state.block;
    game.move('right');
    expect(game.state.block.orientation).toBe('lezici-x');
    expect(game.blockCells()).toEqual([{ x: x + 1, y }, { x: x + 2, y }]);
  });

  it('ležící kostka se dalším tahem postaví', () => {
    const game = createKostka('valeni');
    game.move('right');
    game.move('right');
    expect(game.state.block.orientation).toBe('stojici');
  });

  it('tah zpátky vrátí kostku na původní místo', () => {
    const game = createKostka('valeni');
    const before = { ...game.state.block };
    game.move('right');
    game.move('left');
    expect(game.state.block).toEqual(before);
  });

  it('do stran se ležící kostka jen posune', () => {
    const game = createKostka('valeni');
    game.move('right');
    const before = game.state.block.orientation;
    game.move('down');
    expect(game.state.block.orientation).toBe(before);
  });
});

describe('vyhodnocení', () => {
  it('pád mimo dlaždice úroveň prohraje a postaví ji znovu', () => {
    const game = createKostka('pad');
    play(game, ['up', 'up', 'up', 'up']);
    expect(game.state.lost).toBe(true);
    settle(game);
    expect(game.state.lost).toBe(false);
    expect(game.state.moves).toBe(0);
    // Tahy se ale počítají dál — restart není zadarmo.
    expect(game.state.totalMoves).toBeGreaterThan(0);
  });

  it('křehká dlaždice praskne jen pod stojící kostkou', () => {
    const game = createKostka('krehka', 2);
    // Lehneme si na křehké dlaždice: ty vydrží.
    const fragile = game.state.tiles.findIndex((t) => t === 'krehka');
    expect(fragile).toBeGreaterThanOrEqual(0);
    const fx = fragile % game.state.width;
    const fy = Math.floor(fragile / game.state.width);
    game.state.block = { x: fx, y: fy, orientation: 'lezici-x' };
    expect(game.state.lost).toBe(false);

    game.state.block = { x: fx, y: fy, orientation: 'stojici' };
    game.move('right');
    game.move('left');
    expect(game.state.broken[fragile]).toBe(true);
  });

  it('spínač přepne mosty', () => {
    const game = createKostka('spinac', 3);
    const before = [...game.state.bridgeOn];
    const switchIndex = game.state.tiles.findIndex((t) => t === 'spinac');
    expect(switchIndex).toBeGreaterThanOrEqual(0);
    const sx = switchIndex % game.state.width;
    const sy = Math.floor(switchIndex / game.state.width);
    // Jedno dosednutí na spínač. Tam a zpátky by ho přepnulo dvakrát,
    // tedy zpátky do původního stavu.
    game.state.block = { x: sx, y: sy + 1, orientation: 'lezici-y' };
    game.move('up');
    expect(game.state.block).toEqual({ x: sx, y: sy, orientation: 'stojici' });
    expect(game.state.bridgeOn).not.toEqual(before);
  });

  it('do cíle se propadne jen stojící kostka', () => {
    const game = createKostka('cil');
    const goal = game.state.tiles.findIndex((t) => t === 'cil');
    const gx = goal % game.state.width;
    const gy = Math.floor(goal / game.state.width);

    game.state.block = { x: gx, y: gy, orientation: 'lezici-x' };
    expect(game.state.solved).toBe(false);

    game.state.block = { x: gx - 2, y: gy, orientation: 'lezici-x' };
    game.move('right');
    expect(game.state.solved).toBe(true);
  });

  it('poslední úroveň hru dohraje', () => {
    const game = createKostka('konec', LEVELS.length - 1);
    game.state.solved = true;
    game.state.fallTicks = 1;
    game.step(0);
    expect(game.state.won).toBe(true);
  });
});

describe('ovládání', () => {
  it('šipky posouvají kostku a klávesa B úroveň restartuje', () => {
    const game = createKostka('ovladani');
    const before = { ...game.state.block };
    game.step(BIT.right);
    expect(game.state.block).not.toEqual(before);
    game.step(0);
    game.step(BIT.b);
    expect(game.state.block).toEqual(before);
  });

  it('během pádu kostka nereaguje', () => {
    const game = createKostka('pad-vstup');
    play(game, ['up', 'up', 'up', 'up']);
    expect(game.state.fallTicks).toBeGreaterThan(0);
    const during = { ...game.state.block };
    game.move('right');
    expect(game.state.block).toEqual(during);
  });
});

/**
 * Hledá nejkratší řešení úrovně hrubou silou přes veřejné API.
 *
 * Stav se nekopíruje — každý uzel se přehraje od začátku. Úrovně jsou malé,
 * takže je to levnější než psát druhou implementaci pravidel, která by se
 * mohla od té skutečné rozejít.
 */
function shortestSolution(level: number): number | null {
  const DIRS: Dir[] = ['left', 'right', 'up', 'down'];
  const key = (game: KostkaGame): string => {
    const { x, y, orientation } = game.state.block;
    return `${x},${y},${orientation},${game.state.bridgeOn.join('')}`;
  };

  const start = createKostka('reseni', level);
  const seen = new Set<string>([key(start)]);
  let frontier: Dir[][] = [[]];

  for (let depth = 0; depth < 40 && frontier.length > 0; depth++) {
    const next: Dir[][] = [];
    for (const path of frontier) {
      for (const dir of DIRS) {
        const game = createKostka('reseni', level);
        for (const step of path) game.move(step);
        if (!game.move(dir)) continue;
        if (game.state.solved) return path.length + 1;
        if (game.state.lost) continue;
        const id = key(game);
        if (seen.has(id)) continue;
        seen.add(id);
        next.push([...path, dir]);
      }
    }
    frontier = next;
  }
  return null;
}

describe('řešitelnost', () => {
  it.each(LEVELS.map((level, i) => [level.name, i] as const))(
    '%s má řešení a sedí doporučený počet tahů',
    (name, index) => {
      const best = shortestSolution(index);
      expect(best, `${name}: úroveň nejde dohrát`).not.toBeNull();
      // `par` je slib hráči: musí být dosažitelný, ale ne triviálně nízký.
      expect(best!, name).toBeLessThanOrEqual(LEVELS[index]!.par);
      expect(best!, name).toBeGreaterThan(2);
    },
  );
});
