import { describe, it, expect } from 'vitest';
import { findPath, distanceField, type GridLike } from '../util/pathfinding.js';

/** '#' je zeď, '.' průchozí. */
function gridFrom(rows: string[]): GridLike {
  return {
    width: rows[0]!.length,
    height: rows.length,
    passable: (x, y) => rows[y]?.[x] === '.',
  };
}

describe('findPath', () => {
  it('najde přímou cestu v prázdné mřížce', () => {
    const grid = gridFrom(['.....', '.....', '.....']);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 4, y: 2 });
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 4, y: 2 });
    // Manhattanovská vzdálenost 6 → 7 polí včetně obou konců.
    expect(path).toHaveLength(7);
  });

  it('obejde překážku', () => {
    const grid = gridFrom([
      '.....',
      '.###.',
      '.....',
    ]);
    const path = findPath(grid, { x: 0, y: 1 }, { x: 4, y: 1 });
    expect(path).not.toBeNull();
    expect(path!.every((p) => grid.passable(p.x, p.y))).toBe(true);
  });

  it('vrátí null, když cesta neexistuje', () => {
    const grid = gridFrom([
      '..#..',
      '..#..',
      '..#..',
    ]);
    expect(findPath(grid, { x: 0, y: 0 }, { x: 4, y: 2 })).toBeNull();
  });

  it('vrátí null pro neprůchozí cíl', () => {
    const grid = gridFrom(['...', '.#.', '...']);
    expect(findPath(grid, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });

  it('cesta do sebe sama má jedno pole', () => {
    const grid = gridFrom(['...', '...']);
    expect(findPath(grid, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([{ x: 1, y: 1 }]);
  });

  it('každý krok je sousední pole', () => {
    const grid = gridFrom([
      '.........',
      '.#######.',
      '.......#.',
      '.#####.#.',
      '.......#.',
    ]);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 6, y: 4 })!;
    for (let i = 1; i < path.length; i++) {
      const d = Math.abs(path[i]!.x - path[i - 1]!.x) + Math.abs(path[i]!.y - path[i - 1]!.y);
      expect(d).toBe(1);
    }
  });
});

describe('distanceField', () => {
  it('spočítá vzdálenosti od zdroje', () => {
    const grid = gridFrom(['....', '....']);
    const dist = distanceField(grid, { x: 0, y: 0 });
    expect(dist[0]).toBe(0);
    expect(dist[3]).toBe(3);
    expect(dist[grid.width + 3]).toBe(4);
  });

  it('nedosažitelná pole zůstanou -1', () => {
    const grid = gridFrom(['.#.', '.#.']);
    const dist = distanceField(grid, { x: 0, y: 0 });
    expect(dist[2]).toBe(-1);
  });
});
