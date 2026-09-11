/**
 * Pětipísmenka — vyhodnocení tipu.
 *
 * Nejdůležitější a nejčastěji zkažená část celé hry jsou opakovaná písmena.
 * Vyhodnocuje se dvěma průchody: nejdřív se odeberou přesné trefy, teprve
 * ze zbytku se přiřazují „je ve slově jinde". Bez toho by tip „KOKOS" proti
 * slovu „KOLAK" ukázal obě K jako žlutá, i když je ve slově jen jedno.
 *
 * Diakritika: á a a jsou **různá písmena**. České „ch" se počítá jako dva
 * znaky (c + h) — jinak by nešlo použít pevná pětipísmenná pole a hráč by
 * netušil, kolik znaků má napsat.
 */

export const PETIPISMENKA_RULES_VERSION = 1;

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/** `correct` = zelená, `present` = žlutá, `absent` = šedá. */
export type LetterResult = 'correct' | 'present' | 'absent';

/** Symboly navíc k barvám pro colorblind režim (zadání 5.6). */
export const RESULT_GLYPHS: Record<LetterResult, string> = {
  correct: '✓',
  present: '↔',
  absent: '×',
};

export function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

/** Odstraní diakritiku — jen pro volitelný režim „bez diakritiky". */
export function stripDiacritics(word: string): string {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export interface EvaluateOptions {
  /** Porovnávat bez diakritiky (volba nekonečného režimu). */
  ignoreDiacritics?: boolean;
}

/**
 * Porovná tip s tajným slovem.
 * Obě slova musí mít po normalizaci `WORD_LENGTH` znaků.
 */
export function evaluateGuess(
  guess: string,
  answer: string,
  options: EvaluateOptions = {},
): LetterResult[] {
  let g = normalizeWord(guess);
  let a = normalizeWord(answer);
  if (options.ignoreDiacritics) {
    g = stripDiacritics(g);
    a = stripDiacritics(a);
  }

  const guessChars = [...g];
  const answerChars = [...a];
  if (guessChars.length !== answerChars.length) {
    throw new Error(`Tip a tajné slovo musí mít stejnou délku (${guessChars.length} vs. ${answerChars.length}).`);
  }

  const result: LetterResult[] = Array(guessChars.length).fill('absent');

  // První průchod: přesné trefy. Zabrané znaky se vyřadí z nabídky.
  const remaining = new Map<string, number>();
  for (let i = 0; i < guessChars.length; i++) {
    const letter = answerChars[i]!;
    if (guessChars[i] === letter) {
      result[i] = 'correct';
    } else {
      remaining.set(letter, (remaining.get(letter) ?? 0) + 1);
    }
  }

  // Druhý průchod: „je ve slově jinde", ale jen dokud zbývají volné výskyty.
  for (let i = 0; i < guessChars.length; i++) {
    if (result[i] === 'correct') continue;
    const letter = guessChars[i]!;
    const left = remaining.get(letter) ?? 0;
    if (left > 0) {
      result[i] = 'present';
      remaining.set(letter, left - 1);
    }
  }

  return result;
}

/** Nejlepší dosud zjištěný stav písmene — pro obarvení klávesnice. */
export function mergeKeyboardState(
  current: Map<string, LetterResult>,
  guess: string,
  results: LetterResult[],
): Map<string, LetterResult> {
  const rank: Record<LetterResult, number> = { absent: 0, present: 1, correct: 2 };
  const next = new Map(current);
  const chars = [...normalizeWord(guess)];
  for (let i = 0; i < chars.length; i++) {
    const letter = chars[i]!;
    const result = results[i]!;
    const existing = next.get(letter);
    // Jednou zelené písmeno už nikdy nezešedne.
    if (!existing || rank[result] > rank[existing]) next.set(letter, result);
  }
  return next;
}

export interface HardModeViolation {
  kind: 'missing-correct' | 'missing-present';
  position?: number;
  letter: string;
}

/**
 * Těžký režim: každá odhalená nápověda se musí v dalším tipu použít.
 * Vrací první porušení, nebo `null`, když je tip v pořádku.
 */
export function checkHardMode(
  guess: string,
  previousGuesses: string[],
  previousResults: LetterResult[][],
): HardModeViolation | null {
  const g = [...normalizeWord(guess)];

  for (let round = 0; round < previousGuesses.length; round++) {
    const prev = [...normalizeWord(previousGuesses[round]!)];
    const res = previousResults[round]!;

    for (let i = 0; i < prev.length; i++) {
      if (res[i] === 'correct' && g[i] !== prev[i]) {
        return { kind: 'missing-correct', position: i, letter: prev[i]! };
      }
    }

    for (let i = 0; i < prev.length; i++) {
      if (res[i] !== 'present') continue;
      const letter = prev[i]!;
      // Stačí, že se písmeno v tipu někde objeví.
      if (!g.includes(letter)) {
        return { kind: 'missing-present', letter };
      }
    }
  }

  return null;
}

/** Emoji mřížka pro sdílení — neprozrazuje ani jedno písmeno. */
export function shareGrid(results: LetterResult[][], dayNumber: number, won: boolean): string {
  const symbol: Record<LetterResult, string> = {
    correct: '🟩',
    present: '🟨',
    absent: '⬛',
  };
  const attempts = won ? `${results.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const rows = results.map((row) => row.map((r) => symbol[r]).join('')).join('\n');
  return `Pětipísmenka #${dayNumber} ${attempts}\n\n${rows}`;
}
