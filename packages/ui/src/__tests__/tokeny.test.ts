/**
 * Design tokeny jsou na třech místech: `paleta` v enginu (zdroj pravdy),
 * `tokens.ts` (přebalení do tokenů) a `tokens.css` (CSS proměnné).
 * Tenhle test drží všechna tři v shodě a hlídá kontrast podle WCAG AA —
 * bez něj se rozjedou při první změně barvy a chyba se pozná až na produkci.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { paleta, paletaKategorii, herniPaleta } from '@vevit-games/engine';
import { colors, categoryColors } from '../tokens';

const css = readFileSync(resolve(import.meta.dirname, '../styles/tokens.css'), 'utf8');

/** Načte `:root` proměnné a vyřeší jednu úroveň odkazů `var(--…)`. */
function cssVars(): Map<string, string> {
  const root = css.slice(css.indexOf(':root {'), css.indexOf('color-scheme'));
  const vars = new Map<string, string>();
  for (const match of root.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
    vars.set(match[1]!, match[2]!.trim());
  }
  for (const [name, value] of vars) {
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (ref) vars.set(name, vars.get(ref[1]!) ?? value);
  }
  return vars;
}

const kebab = (key: string): string => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

function luminance(hex: string): number {
  const channel = (value: number): number => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  );
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

describe('design tokeny', () => {
  const vars = cssVars();

  it('tokens.ts přebírá paletu enginu beze změny', () => {
    expect(colors).toBe(paleta);
    expect(categoryColors).toBe(paletaKategorii);
  });

  it('tokens.css zrcadlí každou barvu palety', () => {
    for (const [key, value] of Object.entries(paleta)) {
      expect(vars.get(`--${kebab(key)}`), `--${kebab(key)}`).toBe(value.toLowerCase());
    }
  });

  it('tokens.css zrcadlí barvy kategorií', () => {
    for (const [key, value] of Object.entries(paletaKategorii)) {
      expect(vars.get(`--kat-${key}`), `--kat-${key}`).toBe(value.toLowerCase());
    }
  });

  it('nezůstala žádná barva ze staré tmavomodré palety', () => {
    const stare = ['#0f1c3f', '#172a57', '#2a3f73', '#eef2ff', '#a3b1d6', '#2fd27a'];
    for (const barva of stare) expect(css.toLowerCase()).not.toContain(barva);
  });
});

describe('kontrast podle WCAG AA', () => {
  it('text a barvy kategorií mají na pozadí alespoň 4,5:1', () => {
    const kontrolovane = {
      text: paleta.text,
      textTlumeny: paleta.textTlumeny,
      zelena: paleta.zelena,
      oranzova: paleta.oranzova,
      uspech: paleta.uspech,
      chyba: paleta.chyba,
      varovani: paleta.varovani,
      ...paletaKategorii,
    };
    for (const [name, color] of Object.entries(kontrolovane)) {
      expect(contrast(color, paleta.noc), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('herní odstíny jsou čitelné na herní ploše', () => {
    for (const [name, color] of Object.entries(herniPaleta)) {
      if (name.startsWith('kamen')) continue;
      expect(contrast(color, paleta.noc), name).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color, paleta.pult), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('textPotichu je jen pro velký text (AA large 3:1)', () => {
    expect(contrast(paleta.textPotichu, paleta.noc)).toBeGreaterThanOrEqual(3);
  });
});
