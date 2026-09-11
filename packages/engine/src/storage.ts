/**
 * Ukládání stavu hry.
 *
 * localStorage s verzováním a migracemi. Když je hráč přihlášený, portál
 * stejná data zrcadlí do cloudu (`saves`, limit 64 kB) — to řeší vrstva
 * nad tímhle rozhraním, hra o tom nemusí vědět.
 */

const PREFIX = 'vevit.games';
export const MAX_SAVE_BYTES = 64 * 1024;

export interface StoredEnvelope<T> {
  v: number;
  data: T;
  savedAt: number;
}

export type Migration = (data: unknown, fromVersion: number) => unknown;

export interface GameStorage {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): boolean;
  remove(key: string): void;
  /** Nejlepší lokální skóre pro režim. */
  getBest(mode: string): number | null;
  /** Zapíše rekord, pokud je lepší. Vrací `true`, když se zlepšil. */
  recordBest(mode: string, score: number, scoring?: 'high' | 'low'): boolean;
  /** Rozehraná pozice pro „Pokračuj v hraní". */
  saveGame(data: unknown): boolean;
  loadGame<T>(): T | null;
  clearGame(): void;
}

export interface StorageOptions {
  gameSlug: string;
  /** Aktuální verze formátu dat hry. */
  version: number;
  /** Migrace ze starších verzí — jinak se nekompatibilní data zahodí. */
  migrate?: Migration;
}

function safeParse(raw: string | null): unknown {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** V privátním režimu nebo při plné kvótě localStorage vyhazuje výjimky. */
function safeWrite(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function createStorage(options: StorageOptions): GameStorage {
  const { gameSlug, version, migrate } = options;
  const ns = (key: string): string => `${PREFIX}.${gameSlug}.${key}`;

  const readEnvelope = <T,>(key: string, fallback: T): T => {
    let parsed: unknown;
    try {
      parsed = safeParse(localStorage.getItem(ns(key)));
    } catch {
      return fallback;
    }
    if (parsed == null || typeof parsed !== 'object') return fallback;
    const envelope = parsed as StoredEnvelope<T>;
    if (envelope.v === version) return envelope.data;
    if (migrate) {
      const migrated = migrate(envelope.data, envelope.v);
      if (migrated != null) return migrated as T;
    }
    return fallback;
  };

  const writeEnvelope = <T,>(key: string, data: T): boolean => {
    const envelope: StoredEnvelope<T> = { v: version, data, savedAt: Date.now() };
    return safeWrite(ns(key), JSON.stringify(envelope));
  };

  return {
    get: readEnvelope,
    set: writeEnvelope,

    remove(key) {
      try {
        localStorage.removeItem(ns(key));
      } catch {
        // nedostupné úložiště — nic k úklidu
      }
    },

    getBest(mode) {
      const bests = readEnvelope<Record<string, number>>('best', {});
      return bests[mode] ?? null;
    },

    recordBest(mode, score, scoring = 'high') {
      const bests = readEnvelope<Record<string, number>>('best', {});
      const current = bests[mode];
      const better =
        current == null || (scoring === 'high' ? score > current : score < current);
      if (!better) return false;
      bests[mode] = score;
      writeEnvelope('best', bests);
      return true;
    },

    saveGame(data) {
      const json = JSON.stringify({ v: version, data, savedAt: Date.now() });
      // Limit odpovídá sloupci `saves` v DB, ať se lokální a cloud save chovají stejně.
      if (new Blob([json]).size > MAX_SAVE_BYTES) return false;
      return safeWrite(ns('save'), json);
    },

    loadGame<T>(): T | null {
      const parsed = safeParse(localStorage.getItem(ns('save'))) as StoredEnvelope<T> | null;
      if (parsed == null) return null;
      if (parsed.v === version) return parsed.data;
      if (migrate) return (migrate(parsed.data, parsed.v) as T) ?? null;
      return null;
    },

    clearGame() {
      try {
        localStorage.removeItem(ns('save'));
      } catch {
        // nedostupné úložiště
      }
    },
  };
}

/** Paměťové úložiště pro headless běh a testy. */
export function createMemoryStorage(): GameStorage {
  const map = new Map<string, unknown>();
  return {
    get: <T,>(key: string, fallback: T): T => (map.has(key) ? (map.get(key) as T) : fallback),
    set: (key, value) => {
      map.set(key, value);
      return true;
    },
    remove: (key) => void map.delete(key),
    getBest: (mode) => (map.get(`best:${mode}`) as number) ?? null,
    recordBest(mode, score, scoring = 'high') {
      const current = map.get(`best:${mode}`) as number | undefined;
      const better = current == null || (scoring === 'high' ? score > current : score < current);
      if (better) map.set(`best:${mode}`, score);
      return better;
    },
    saveGame: (data) => {
      map.set('save', data);
      return true;
    },
    loadGame: <T,>(): T | null => (map.get('save') as T) ?? null,
    clearGame: () => void map.delete('save'),
  };
}
