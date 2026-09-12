/**
 * Katalog her.
 *
 * Manifesty se načítají staticky (portál je potřebuje pro výpis a hledání),
 * samotná hra se stahuje až při spuštění — každá je vlastní chunk.
 */

import type { GameManifest, GameModule, GameCategory } from '@vevit-games/engine';

import { manifest as kostkopad } from '@titles/kostkopad/src/manifest.js';
import { manifest as zdvojka } from '@titles/zdvojka/src/manifest.js';
import { manifest as had } from '@titles/had/src/manifest.js';
import { manifest as hledacMin } from '@titles/hledac-min/src/manifest.js';
import { manifest as petipismenka } from '@titles/petipismenka/src/manifest.js';
import { manifest as pasiansy } from '@titles/pasiansy/src/manifest.js';
import { manifest as mavnik } from '@titles/mavnik/src/manifest.js';
import { manifest as pexeso } from '@titles/pexeso/src/manifest.js';
import { manifest as ctyriVRade } from '@titles/ctyri-v-rade/src/manifest.js';
import { manifest as cihlobijec } from '@titles/cihlobijec/src/manifest.js';
import { manifest as invaze } from '@titles/invaze/src/manifest.js';
import { manifest as hladovec } from '@titles/hladovec/src/manifest.js';
import { manifest as bezec } from '@titles/bezec/src/manifest.js';
import { manifest as piskvorky } from '@titles/piskvorky/src/manifest.js';
import { manifest as odpal } from '@titles/odpal/src/manifest.js';
import { manifest as sudoku } from '@titles/sudoku/src/manifest.js';
import { manifest as kostka } from '@titles/kostka/src/manifest.js';
import { manifest as lovecUzemi } from '@titles/lovec-uzemi/src/manifest.js';
import { manifest as superSkokan } from '@titles/super-skokan/src/manifest.js';

export interface CatalogEntry {
  manifest: GameManifest;
  load(): Promise<GameModule>;
}

export const catalog: CatalogEntry[] = [
  { manifest: kostkopad, load: () => import('@titles/kostkopad/src/index.js') as Promise<GameModule> },
  { manifest: petipismenka, load: () => import('@titles/petipismenka/src/index.js') as Promise<GameModule> },
  { manifest: zdvojka, load: () => import('@titles/zdvojka/src/index.js') as Promise<GameModule> },
  { manifest: had, load: () => import('@titles/had/src/index.js') as Promise<GameModule> },
  { manifest: hledacMin, load: () => import('@titles/hledac-min/src/index.js') as Promise<GameModule> },
  { manifest: pasiansy, load: () => import('@titles/pasiansy/src/index.js') as Promise<GameModule> },
  { manifest: mavnik, load: () => import('@titles/mavnik/src/index.js') as Promise<GameModule> },
  { manifest: pexeso, load: () => import('@titles/pexeso/src/index.js') as Promise<GameModule> },
  { manifest: ctyriVRade, load: () => import('@titles/ctyri-v-rade/src/index.js') as Promise<GameModule> },
  { manifest: cihlobijec, load: () => import('@titles/cihlobijec/src/index.js') as Promise<GameModule> },
  { manifest: invaze, load: () => import('@titles/invaze/src/index.js') as Promise<GameModule> },
  { manifest: hladovec, load: () => import('@titles/hladovec/src/index.js') as Promise<GameModule> },
  { manifest: bezec, load: () => import('@titles/bezec/src/index.js') as Promise<GameModule> },
  { manifest: piskvorky, load: () => import('@titles/piskvorky/src/index.js') as Promise<GameModule> },
  { manifest: odpal, load: () => import('@titles/odpal/src/index.js') as Promise<GameModule> },
  { manifest: sudoku, load: () => import('@titles/sudoku/src/index.js') as Promise<GameModule> },
  { manifest: kostka, load: () => import('@titles/kostka/src/index.js') as Promise<GameModule> },
  { manifest: lovecUzemi, load: () => import('@titles/lovec-uzemi/src/index.js') as Promise<GameModule> },
  { manifest: superSkokan, load: () => import('@titles/super-skokan/src/index.js') as Promise<GameModule> },
];

export const bySlug = (slug: string): CatalogEntry | undefined =>
  catalog.find((entry) => entry.manifest.slug === slug);

export const byCategory = (category: GameCategory): CatalogEntry[] =>
  catalog.filter((entry) => entry.manifest.category === category);

export const categoriesInOrder: GameCategory[] = [
  'logika', 'arkady', 'akce', 'spolu', 'karty', 'original',
];

/** Pořadí kategorií, ve kterém mají hry — prázdné police se nezobrazují. */
export const nonEmptyCategories = (): GameCategory[] =>
  categoriesInOrder.filter((category) => byCategory(category).length > 0);

/** Odstraní diakritiku a sjednotí velikost — hledání má být odpouštějící. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface SearchFilters {
  category?: GameCategory | 'vse';
  /** Hry pro daný počet hráčů. */
  players?: number;
  /** Nejdelší přijatelná délka partie v minutách. */
  maxSessionMin?: number;
  touchOnly?: boolean;
}

/**
 * Fuzzy hledání necitlivé na diakritiku.
 * Skóre: shoda od začátku názvu > shoda kdekoliv v názvu > shoda ve štítcích.
 */
export function search(query: string, filters: SearchFilters = {}): CatalogEntry[] {
  const q = fold(query.trim());

  let results = catalog.filter((entry) => {
    const { manifest } = entry;
    if (filters.category && filters.category !== 'vse' && manifest.category !== filters.category) return false;
    if (filters.players != null) {
      if (filters.players < manifest.players.min || filters.players > manifest.players.max) return false;
    }
    if (filters.maxSessionMin != null && manifest.avgSessionMin > filters.maxSessionMin) return false;
    if (filters.touchOnly && !manifest.controls.touch) return false;
    return true;
  });

  if (q.length === 0) return results;

  const scored = results
    .map((entry) => {
      const title = fold(entry.manifest.title.cs);
      const titleEn = fold(entry.manifest.title.en);
      const tagline = fold(entry.manifest.tagline.cs);
      const tags = entry.manifest.tags.map(fold).join(' ');

      let score = 0;
      if (title.startsWith(q) || titleEn.startsWith(q)) score = 100;
      else if (title.includes(q) || titleEn.includes(q)) score = 70;
      else if (tags.includes(q)) score = 40;
      else if (tagline.includes(q)) score = 20;
      else if (subsequence(q, title)) score = 10;

      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((item) => item.entry);
}

/** Písmena dotazu se v názvu vyskytují ve správném pořadí (překlepy, zkratky). */
function subsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const char of haystack) {
    if (char === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}
