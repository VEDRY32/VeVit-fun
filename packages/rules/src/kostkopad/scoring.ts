/** Bodování Kostkopádu. Změna těchto hodnot vyžaduje zvýšení `rulesVersion`. */

export const KOSTKOPAD_RULES_VERSION = 1;

export type ClearKind =
  | 'none'
  | 'single' | 'double' | 'triple' | 'quad'
  | 'tspin' | 'tspin-single' | 'tspin-double' | 'tspin-triple'
  | 'mini' | 'mini-single' | 'mini-double';

const BASE_SCORE: Record<ClearKind, number> = {
  none: 0,
  single: 100,
  double: 300,
  triple: 500,
  quad: 800,
  tspin: 400,
  'tspin-single': 800,
  'tspin-double': 1200,
  'tspin-triple': 1600,
  mini: 100,
  'mini-single': 200,
  'mini-double': 400,
};

/** Mazání, která drží sérii „hned po sobě" (back-to-back). */
const B2B_KINDS = new Set<ClearKind>([
  'quad', 'tspin', 'tspin-single', 'tspin-double', 'tspin-triple',
  'mini', 'mini-single', 'mini-double',
]);

export const isB2bKind = (kind: ClearKind): boolean => B2B_KINDS.has(kind);

/** Mazání, které sérii přeruší (obyčejné mazání bez otočky). */
export const breaksB2b = (kind: ClearKind, lines: number): boolean =>
  lines > 0 && !B2B_KINDS.has(kind);

const PERFECT_CLEAR: Record<number, number> = { 1: 800, 2: 1200, 3: 1800, 4: 2000 };

export interface ScoreInput {
  kind: ClearKind;
  lines: number;
  level: number;
  /** Počet mazání v řadě bez mezery, -1 = žádné combo. */
  combo: number;
  /** Předchozí mazání drželo sérii. */
  backToBack: boolean;
  perfectClear: boolean;
  softDropCells: number;
  hardDropCells: number;
}

export function scoreFor(input: ScoreInput): number {
  const { kind, lines, level, combo, backToBack, perfectClear, softDropCells, hardDropCells } = input;

  let points = BASE_SCORE[kind] * level;
  if (backToBack && isB2bKind(kind)) points = Math.floor(points * 1.5);
  if (combo > 0) points += 50 * combo * level;
  if (perfectClear && lines > 0) {
    const bonus = (PERFECT_CLEAR[lines] ?? 0) * level;
    points += backToBack ? bonus * 2 : bonus;
  }
  points += softDropCells + hardDropCells * 2;
  return points;
}

/**
 * Gravitace podle úrovně v buňkách za krok (Q16.16).
 *
 * Tabulka se počítá jednou při načtení modulu a zaokrouhluje na celá čísla,
 * takže výsledek je na všech platformách bit-identický (D-010).
 */
export const MAX_LEVEL = 20;

export const GRAVITY_TABLE: Int32Array = (() => {
  const table = new Int32Array(MAX_LEVEL + 1);
  for (let level = 1; level <= MAX_LEVEL; level++) {
    // Sekundy na jednu řadu — klasická křivka, od ~1 s po ~0,02 s.
    const secondsPerRow = (0.8 - (level - 1) * 0.007) ** (level - 1);
    const cellsPerTick = 1 / (secondsPerRow * 60);
    table[level] = Math.round(Math.min(cellsPerTick, 20) * 65536);
  }
  table[0] = table[1]!;
  return table;
})();

export const gravityFor = (level: number): number =>
  GRAVITY_TABLE[Math.max(1, Math.min(MAX_LEVEL, level))]!;

/** Úroveň roste po každých deseti smazaných řadách. */
export const levelFor = (lines: number): number => Math.floor(lines / 10) + 1;

/**
 * Odpadní řádky poslané soupeři v online souboji.
 * T-otočky a combo posílají víc — odměňuje to techniku, ne rychlost.
 */
export function garbageFor(kind: ClearKind, combo: number, backToBack: boolean, perfectClear: boolean): number {
  const base: Partial<Record<ClearKind, number>> = {
    single: 0, double: 1, triple: 2, quad: 4,
    'tspin-single': 2, 'tspin-double': 4, 'tspin-triple': 6,
    'mini-single': 0, 'mini-double': 1,
  };
  let lines = base[kind] ?? 0;
  if (backToBack && isB2bKind(kind)) lines += 1;
  if (combo > 0) lines += Math.min(4, Math.floor(combo / 2));
  if (perfectClear) lines += 6;
  return lines;
}
