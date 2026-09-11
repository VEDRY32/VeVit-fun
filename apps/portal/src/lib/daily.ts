/**
 * Denní výzvy a série dní.
 *
 * Tři hry denně se stejným zadáním pro všechny. Které tři, to se odvozuje
 * z data — ne z náhody na klientu, aby měli všichni hráči totéž i bez API.
 */

import { dailySeed } from '@vevit-games/engine';
import { catalog } from './catalog.js';

const STATE_KEY = 'vevit.games.daily';

/** Dnešní datum v Praze; výzvy se mění o půlnoci místního času. */
export function pragueToday(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(now);
}

/** Pořadové číslo dne — používá se ve sdíleném textu („#42"). */
export function dayNumber(date = pragueToday()): number {
  const epoch = Date.UTC(2026, 0, 1);
  return Math.floor((Date.parse(`${date}T00:00:00Z`) - epoch) / 86_400_000) + 1;
}

export interface DailyChallenge {
  slug: string;
  title: string;
  seed: string;
  done: boolean;
  score: number | null;
}

interface DailyState {
  /** Datum, ke kterému se stav vztahuje. */
  date: string;
  /** slug → skóre */
  completed: Record<string, number>;
  streak: number;
  /** Poslední den, kdy hráč dokončil aspoň jednu výzvu. */
  lastPlayed: string;
  bestStreak: number;
}

const EMPTY: DailyState = {
  date: '', completed: {}, streak: 0, lastPlayed: '', bestStreak: 0,
};

function read(): DailyState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<DailyState>) };
  } catch {
    return { ...EMPTY };
  }
}

function write(state: DailyState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Bez úložiště série nepřežije, hrát ale jde dál.
  }
}

/** Hry, které mají denní režim. Pořadí je stabilní, ne náhodné. */
const dailyCapable = (): string[] =>
  catalog
    .filter((entry) => entry.manifest.modes.some((mode) => mode.id === 'denni'))
    .map((entry) => entry.manifest.slug);

/**
 * Tři hry na daný den. Rotují deterministicky podle čísla dne, takže
 * hráč nedostane každý den tytéž tři, ale všichni mají stejné.
 */
export function challengesFor(date = pragueToday()): DailyChallenge[] {
  const pool = dailyCapable();
  if (pool.length === 0) return [];

  const state = read();
  const completed = state.date === date ? state.completed : {};
  const day = dayNumber(date);
  const count = Math.min(3, pool.length);

  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    // Krok 7 rozhází výběr i u malého katalogu; nesoudělnost s délkou
    // pole hlídá `while`, aby se hra neopakovala.
    let index = (day * 7 + i * 3) % pool.length;
    let guard = 0;
    while (picked.includes(pool[index]!) && guard++ < pool.length) {
      index = (index + 1) % pool.length;
    }
    picked.push(pool[index]!);
  }

  return picked.map((slug) => {
    const entry = catalog.find((e) => e.manifest.slug === slug)!;
    return {
      slug,
      title: entry.manifest.title.cs,
      seed: dailySeed(slug, date),
      done: slug in completed,
      score: completed[slug] ?? null,
    };
  });
}

/** Zapíše dokončenou výzvu a případně prodlouží sérii. */
export function completeChallenge(slug: string, score: number, date = pragueToday()): DailyState {
  const state = read();

  // Nový den: stav dokončených se vynuluje.
  if (state.date !== date) {
    state.date = date;
    state.completed = {};
  }

  const isFirstToday = Object.keys(state.completed).length === 0;
  // Lepší výsledek přepíše horší; první zápis dne prodlouží sérii.
  const previous = state.completed[slug];
  if (previous == null || score > previous) state.completed[slug] = score;

  if (isFirstToday) {
    const yesterday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' })
      .format(new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000));
    // Série pokračuje jen tehdy, když hráč hrál i včera.
    state.streak = state.lastPlayed === yesterday ? state.streak + 1 : 1;
    state.lastPlayed = date;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
  }

  write(state);
  return state;
}

export function currentStreak(date = pragueToday()): number {
  const state = read();
  if (state.lastPlayed === date) return state.streak;

  const yesterday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' })
    .format(new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000));
  // Série drží i dnes, dokud hráč nezmešká celý den.
  return state.lastPlayed === yesterday ? state.streak : 0;
}

export const bestStreak = (): number => read().bestStreak;

/** Kolik z dnešních tří výzev je hotových. */
export function progressToday(date = pragueToday()): { done: number; total: number } {
  const challenges = challengesFor(date);
  return { done: challenges.filter((c) => c.done).length, total: challenges.length };
}
