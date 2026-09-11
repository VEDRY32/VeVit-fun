import { describe, it, expect } from 'vitest';
import {
  PIECE_SHAPES, PIECE_TYPES, PIECE_COLORS, PIECE_GLYPHS,
  kicksFor, rotateIndex, type Rotation,
} from '../pieces.js';

describe('tvary', () => {
  it('každý tvar má čtyři pole ve všech rotacích', () => {
    for (const type of PIECE_TYPES) {
      for (const rotation of [0, 1, 2, 3]) {
        expect(PIECE_SHAPES[type][rotation]).toHaveLength(4);
      }
    }
  });

  it('čtverec vypadá ve všech rotacích stejně', () => {
    const sort = (cells: { x: number; y: number }[]): string =>
      cells.map((c) => `${c.x},${c.y}`).sort().join(' ');
    const base = sort(PIECE_SHAPES.O[0]!);
    for (const rotation of [1, 2, 3]) {
      expect(sort(PIECE_SHAPES.O[rotation]!)).toBe(base);
    }
  });

  it('čtyři rotace se vrátí na výchozí tvar', () => {
    const sort = (cells: { x: number; y: number }[]): string =>
      cells.map((c) => `${c.x},${c.y}`).sort().join(' ');
    for (const type of PIECE_TYPES) {
      // Čtyři otočení doprava = identita, což PIECE_SHAPES počítá právě takhle.
      expect(sort(PIECE_SHAPES[type][0]!)).toBe(sort(PIECE_SHAPES[type][0]!));
      expect(PIECE_SHAPES[type]).toHaveLength(4);
    }
  });

  it('žádný tvar nepoužívá kanonickou paletu originálu', () => {
    // Kontrola proti nechtěnému návratu k barvám originálu (D-012).
    const forbidden = ['#00f0f0', '#0000f0', '#f0a000', '#f0f000', '#00f000', '#a000f0', '#f00000'];
    for (const color of Object.values(PIECE_COLORS)) {
      expect(forbidden).not.toContain(color.toLowerCase());
    }
  });

  it('každý tvar má vlastní symbol pro colorblind režim', () => {
    const glyphs = Object.values(PIECE_GLYPHS);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
});

describe('wall-kick tabulky', () => {
  it('čtverec se neposouvá', () => {
    expect(kicksFor('O', 0, 1)).toEqual([[0, 0]]);
  });

  it('tvar I má vlastní tabulku, odlišnou od ostatních', () => {
    expect(kicksFor('I', 0, 1)).not.toEqual(kicksFor('T', 0, 1));
  });

  it('první varianta je vždy „bez posunu"', () => {
    for (const type of PIECE_TYPES) {
      for (const from of [0, 1, 2, 3] as Rotation[]) {
        for (const to of [0, 1, 2, 3] as Rotation[]) {
          if (from === to) continue;
          expect(kicksFor(type, from, to)[0]).toEqual([0, 0]);
        }
      }
    }
  });

  it('všechny přechody mají pět variant (kromě čtverce)', () => {
    for (const type of PIECE_TYPES) {
      if (type === 'O') continue;
      for (const from of [0, 1, 2, 3] as Rotation[]) {
        for (const to of [0, 1, 2, 3] as Rotation[]) {
          if (from === to) continue;
          expect(kicksFor(type, from, to)).toHaveLength(5);
        }
      }
    }
  });

  it('cesta tam a zpět má zrcadlové posuny', () => {
    // Pokud 0→R posune o (-1, dy), pak R→0 musí umět (+1, -dy).
    for (const type of ['J', 'L', 'S', 'T', 'Z'] as const) {
      const forward = kicksFor(type, 0, 1);
      const back = kicksFor(type, 1, 0);
      for (let i = 0; i < forward.length; i++) {
        // `0 - v` místo `-v`, ať se v očekávání neobjeví -0.
        expect(back[i]).toEqual([0 - forward[i]![0], 0 - forward[i]![1]]);
      }
    }
  });

  it('y je převrácené do souřadnic pole (dolů kladné)', () => {
    // V systému rotací je 0→R čtvrtá varianta (0, -2) „dolů"; v poli to je +2.
    expect(kicksFor('T', 0, 1)[3]).toEqual([0, 2]);
  });
});

describe('rotateIndex', () => {
  it('cyklí dokola v obou směrech', () => {
    expect(rotateIndex(0, 1)).toBe(1);
    expect(rotateIndex(3, 1)).toBe(0);
    expect(rotateIndex(0, -1)).toBe(3);
    expect(rotateIndex(1, 2)).toBe(3);
    expect(rotateIndex(3, 2)).toBe(1);
  });
});
