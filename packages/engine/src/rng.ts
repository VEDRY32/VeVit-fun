/**
 * Deterministický generátor náhodných čísel (sfc32).
 *
 * Herní logika nesmí používat `Math.random` — jediný zdroj náhody je seed,
 * který přiděluje server. Díky tomu jde běh přehrát a ověřit (D-008).
 */

export interface Rng {
  /** Celé číslo 0..2^32-1. */
  u32(): number;
  /** Desetinné číslo v <0, 1). */
  next(): number;
  /** Celé číslo v <min, max). */
  int(min: number, max: number): number;
  /** Desetinné číslo v <min, max). */
  range(min: number, max: number): number;
  /** Náhodný prvek pole. Prázdné pole vrací `undefined`. */
  pick<T>(items: readonly T[]): T;
  /** Zamíchá kopii pole (Fisher–Yates). Vstup nemění. */
  shuffle<T>(items: readonly T[]): T[];
  /** `true` s danou pravděpodobností (0..1). */
  chance(p: number): boolean;
  /** Stav generátoru — pro uložení a obnovení běhu. */
  getState(): RngState;
  setState(state: RngState): void;
  /** Nezávislý generátor odvozený od tohoto (např. pro efekty mimo logiku). */
  fork(label: string): Rng;
}

export type RngState = readonly [number, number, number, number];

/** Rozprostře libovolný textový seed do čtyř 32bitových slov (xmur3). */
export function hashSeed(seed: string): RngState {
  let h = 1779033703 ^ seed.length;
  const out: number[] = [];
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  for (let i = 0; i < 4; i++) {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    out.push(h >>> 0);
  }
  return out as unknown as RngState;
}

/**
 * sfc32 — malý, rychlý, s periodou ~2^128 a dobrým rozdělením.
 * Stejný seed dá stejnou posloupnost v každém prohlížeči i v Node.
 */
export function createRng(seed: string | RngState): Rng {
  let [a, b, c, d] = typeof seed === 'string' ? hashSeed(seed) : seed;

  // Zahřátí — první hodnoty z málo rozprostřeného stavu bývají korelované.
  const step = (): number => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 12; i++) step();

  const rng: Rng = {
    u32: step,
    next: () => step() / 4294967296,
    int(min, max) {
      if (max <= min) return min;
      return min + (step() % (max - min));
    },
    range(min, max) {
      return min + (step() / 4294967296) * (max - min);
    },
    pick<T>(items: readonly T[]): T {
      return items[step() % items.length] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = step() % (i + 1);
        const tmp = copy[i] as T;
        copy[i] = copy[j] as T;
        copy[j] = tmp;
      }
      return copy;
    },
    chance: (p) => step() / 4294967296 < p,
    getState: () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0] as const,
    setState(state) {
      [a, b, c, d] = state;
    },
    fork(label) {
      return createRng(`${a}:${b}:${c}:${d}:${label}`);
    },
  };
  return rng;
}

/** Seed denní výzvy — stejný pro všechny hráče, mění se o půlnoci v Praze. */
export function dailySeed(gameSlug: string, isoDate: string): string {
  return `daily:${gameSlug}:${isoDate}`;
}
