import { describe, it, expect } from 'vitest';
import { createZdvojka, type ZdvojkaGame } from '../game.js';

/** Nastaví mřížku přímo — pohodlnější než dohrávat se k dané pozici. */
function setGrid(game: ZdvojkaGame, rows: number[][]): void {
  let id = 1000;
  game.state.tiles = [];
  rows.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value > 0) {
        game.state.tiles.push({ id: id++, value, x, y, fromX: x, fromY: y, merged: false, spawned: false });
      }
    });
  });
}

/** Mřížka bez dlaždice, která se objevila v posledním tahu. */
function gridWithoutSpawn(game: ZdvojkaGame): number[][] {
  const out = Array.from({ length: game.config.size }, () => Array<number>(game.config.size).fill(0));
  for (const tile of game.state.tiles) {
    if (!tile.spawned) out[tile.y]![tile.x] = tile.value;
  }
  return out;
}

describe('Zdvojka', () => {
  it('začíná se dvěma dlaždicemi', () => {
    const game = createZdvojka('start');
    expect(game.state.tiles).toHaveLength(2);
    for (const tile of game.state.tiles) expect([2, 4]).toContain(tile.value);
  });

  it('stejný seed dá stejnou hru', () => {
    const a = createZdvojka('stejny');
    const b = createZdvojka('stejny');
    for (const dir of ['left', 'up', 'right', 'down'] as const) {
      a.move(dir);
      b.move(dir);
    }
    expect(a.grid()).toEqual(b.grid());
    expect(a.state.score).toBe(b.state.score);
  });

  it('posun doleva slepí dlaždice k okraji', () => {
    const game = createZdvojka('posun');
    setGrid(game, [
      [0, 0, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    game.move('left');
    expect(gridWithoutSpawn(game)[0]).toEqual([2, 0, 0, 0]);
  });

  it('dvě stejné dlaždice se sloučí a připíšou body', () => {
    const game = createZdvojka('slouceni');
    setGrid(game, [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const before = game.state.score;
    game.move('left');
    expect(gridWithoutSpawn(game)[0]![0]).toBe(4);
    expect(game.state.score).toBe(before + 4);
  });

  it('dlaždice se v jednom tahu sloučí nejvýš jednou', () => {
    // 2 2 2 2 → 4 4, ne 8.
    const game = createZdvojka('jedno-slouceni');
    setGrid(game, [
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    game.move('left');
    const row = gridWithoutSpawn(game)[0]!;
    expect(row.slice(0, 2)).toEqual([4, 4]);
  });

  it('tři stejné sloučí jen dvojici u cílové stěny', () => {
    const game = createZdvojka('tri');
    setGrid(game, [
      [2, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    game.move('left');
    const row = gridWithoutSpawn(game)[0]!;
    expect(row.slice(0, 2)).toEqual([4, 2]);
  });

  it('tah, který nic nezmění, se nepočítá', () => {
    const game = createZdvojka('nic');
    setGrid(game, [
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const moves = game.state.moves;
    expect(game.move('up')).toBe(false);
    expect(game.state.moves).toBe(moves);
  });

  it('po platném tahu přibude nová dlaždice', () => {
    const game = createZdvojka('nova');
    setGrid(game, [
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    game.move('left');
    expect(game.state.tiles).toHaveLength(2);
    expect(game.state.tiles.some((t) => t.spawned)).toBe(true);
  });

  it('hra končí, když není žádný tah', () => {
    const game = createZdvojka('konec');
    setGrid(game, [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 8],
    ]);
    // Poslední volný tah: sloučení 4 a 4 ve sloupci neexistuje → konec.
    expect(game.move('left')).toBe(false);
    expect(game.move('up')).toBe(false);
  });

  it('dosažení 2048 znamená výhru, ale hra pokračuje', () => {
    const game = createZdvojka('vyhra');
    setGrid(game, [
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    game.move('left');
    expect(game.state.won).toBe(true);
    expect(game.state.over).toBe(false);
  });

  it('krok zpět funguje jen v pohodovém režimu a jen jednou', () => {
    const relaxed = createZdvojka('zpet', { mode: 'pohodovy' });
    setGrid(relaxed, [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    relaxed.move('left');
    expect(relaxed.undo()).toBe(true);
    expect(relaxed.undo()).toBe(false);

    const ranked = createZdvojka('zpet-hodnoceny', { mode: 'klasik' });
    setGrid(ranked, [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    ranked.move('left');
    expect(ranked.undo()).toBe(false);
  });

  it('zvládne i větší mřížku', () => {
    const game = createZdvojka('velka', { size: 6 });
    expect(game.grid()).toHaveLength(6);
    expect(game.grid()[0]).toHaveLength(6);
  });

  it('časovka skončí po vypršení limitu', () => {
    const game = createZdvojka('cas', { mode: 'casovka', timeLimitTicks: 100 });
    for (let i = 0; i < 101; i++) game.step(0);
    expect(game.state.over).toBe(true);
  });
});
