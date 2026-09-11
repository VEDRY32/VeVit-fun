/** Nastavení portálu — přežívá v localStorage a platí napříč všemi hrami. */

import type { Keymap, Locale } from '@vevit-games/engine';

export interface PortalSettings {
  locale: Locale;
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  reducedMotion: boolean;
  colorblind: boolean;
  lowQuality: boolean;
  leftHanded: boolean;
  /** Přemapované klávesy; prázdné = výchozí rozložení hry. */
  keymap: Partial<Keymap>;
}

const KEY = 'vevit.games.settings';

export const DEFAULT_SETTINGS: PortalSettings = {
  locale: 'cs',
  master: 0.8,
  music: 0.5,
  sfx: 0.9,
  muted: false,
  reducedMotion: false,
  colorblind: false,
  lowQuality: false,
  leftHanded: false,
  keymap: {},
};

export function loadSettings(): PortalSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return withSystemPreferences(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<PortalSettings>;
    return withSystemPreferences({ ...DEFAULT_SETTINGS, ...parsed });
  } catch {
    // Privátní režim nebo zaplněná kvóta — jedeme na výchozích hodnotách.
    return withSystemPreferences(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: PortalSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Nastavení se neuloží, ale hrát se dá dál.
  }
}

/** Systémové `prefers-reduced-motion` má přednost, dokud ho hráč nepřebije. */
function withSystemPreferences(settings: PortalSettings): PortalSettings {
  if (typeof window === 'undefined' || !window.matchMedia) return settings;
  const systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { ...settings, reducedMotion: settings.reducedMotion || systemReduced };
}

// --- Oblíbené a naposledy hrané -------------------------------------------

const FAVORITES_KEY = 'vevit.games.favorites';
const RECENT_KEY = 'vevit.games.recent';
const RECENT_LIMIT = 8;

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // nedostupné úložiště
  }
}

export const loadFavorites = (): string[] => readList(FAVORITES_KEY);

export function toggleFavorite(slug: string): string[] {
  const current = loadFavorites();
  const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
  writeList(FAVORITES_KEY, next);
  return next;
}

export const loadRecent = (): string[] => readList(RECENT_KEY);

export function recordPlayed(slug: string): void {
  const next = [slug, ...loadRecent().filter((s) => s !== slug)].slice(0, RECENT_LIMIT);
  writeList(RECENT_KEY, next);
}

// --- Počty odehraných partií ------------------------------------------------

const PLAYS_KEY = 'vevit.games.plays';

/** slug → kolikrát hráč hru dohrál. Podklad pro odznaky a profil. */
export function loadPlays(): Record<string, number> {
  try {
    const raw = localStorage.getItem(PLAYS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

export function savePlays(plays: Record<string, number>): void {
  try {
    localStorage.setItem(PLAYS_KEY, JSON.stringify(plays));
  } catch {
    // Bez úložiště se počty neuloží; hrát to nebrání.
  }
}
