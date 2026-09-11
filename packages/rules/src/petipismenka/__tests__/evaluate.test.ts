import { describe, it, expect } from 'vitest';
import {
  evaluateGuess, mergeKeyboardState, checkHardMode, shareGrid,
  stripDiacritics, RESULT_GLYPHS, WORD_LENGTH, MAX_GUESSES,
  type LetterResult,
} from '../evaluate.js';

const short = (results: LetterResult[]): string =>
  results.map((r) => (r === 'correct' ? 'Z' : r === 'present' ? 'Y' : '_')).join('');

describe('evaluateGuess — základ', () => {
  it('označí přesnou shodu celého slova', () => {
    expect(short(evaluateGuess('kolik', 'kolik'))).toBe('ZZZZZ');
  });

  it('označí úplnou neshodu', () => {
    expect(short(evaluateGuess('bcdfg', 'aehij'))).toBe('_____');
  });

  it('rozpozná písmeno na špatném místě', () => {
    // tip  k o l i k
    // slovo l o k i k  → o, i, k sedí; k a l jsou ve slově, ale jinde
    expect(short(evaluateGuess('kolik', 'lokik'))).toBe('YZYZZ');
  });

  it('nezáleží na velikosti písmen', () => {
    expect(short(evaluateGuess('KoLiK', 'kolik'))).toBe('ZZZZZ');
  });

  it('odmítne tip jiné délky', () => {
    expect(() => evaluateGuess('krat', 'kolik')).toThrow(/stejnou délku/);
  });
});

describe('evaluateGuess — opakovaná písmena', () => {
  /**
   * Nejčastější chyba: druhé stejné písmeno se obarví, i když ve slově
   * žádný volný výskyt nezbývá.
   */
  it('druhé stejné písmeno zůstane šedé, když ve slově je jen jedno', () => {
    // "sesle" má jedno S na začátku; tip "sysel" má dvě S.
    const result = evaluateGuess('sasas', 'sarna');
    expect(result[0]).toBe('correct');   // S na svém místě
    expect(result[4]).toBe('absent');    // druhé S už nemá kam
  });

  it('přesná shoda má přednost před shodou jinde', () => {
    // Tajné "otava", tip "aatoa": poslední A sedí přesně.
    const result = evaluateGuess('aaaaa', 'otava');
    const correctCount = result.filter((r) => r === 'correct').length;
    const presentCount = result.filter((r) => r === 'present').length;
    expect(correctCount).toBe(2);   // A na pozici 2 a 4
    expect(presentCount).toBe(0);   // víc áček ve slově není
  });

  it('dvě stejná písmena ve slově obarví obě', () => {
    // tip  a a b c d
    // slovo d a a x y  → druhé A sedí přesně, první je ve slově jinde
    const result = evaluateGuess('aabcd', 'daaxy');
    expect(result[0]).toBe('present');
    expect(result[1]).toBe('correct');
    expect(result[4]).toBe('present'); // D je ve slově na začátku
  });

  it('počet žlutých nikdy nepřekročí počet výskytů ve slově', () => {
    const answer = 'kolek';
    for (const guess of ['kkkkk', 'ooooo', 'lllll', 'eeeee', 'kokok']) {
      const result = evaluateGuess(guess, answer);
      const letters = [...guess];
      for (const letter of new Set(letters)) {
        const inAnswer = [...answer].filter((c) => c === letter).length;
        const marked = result.filter((r, i) => r !== 'absent' && letters[i] === letter).length;
        expect(marked).toBeLessThanOrEqual(inAnswer);
      }
    }
  });
});

describe('evaluateGuess — diakritika', () => {
  it('písmeno s čárkou je jiné písmeno než bez ní', () => {
    // A se od Á liší, takže druhá pozice nesedí — a protože ve slově žádné
    // holé A není, nedostane ani žlutou.
    expect(short(evaluateGuess('malin', 'málin'))).toBe('Z_ZZZ');
  });

  it('v režimu bez diakritiky se á a a shodují', () => {
    expect(short(evaluateGuess('malin', 'málin', { ignoreDiacritics: true }))).toBe('ZZZZZ');
  });

  it('stripDiacritics zvládne české znaky', () => {
    expect(stripDiacritics('žluťoučký')).toBe('zlutoucky');
    expect(stripDiacritics('příšerně')).toBe('priserne');
    expect(stripDiacritics('ĚŠČŘŽÝÁÍÉŮÚ'.toLowerCase())).toBe('escrzyaieuu');
  });

  it('„ch" se počítá jako dva znaky', () => {
    // Pětiznakové slovo s „ch" má jen čtyři české hlásky — pole je pětiznakové.
    const result = evaluateGuess('chleb', 'chleb');
    expect(result).toHaveLength(WORD_LENGTH);
    expect(result.every((r) => r === 'correct')).toBe(true);
  });
});

describe('mergeKeyboardState', () => {
  it('zelená přebije žlutou i šedou', () => {
    let state = new Map<string, LetterResult>();
    state = mergeKeyboardState(state, 'kolik', evaluateGuess('kolik', 'lokik'));
    expect(state.get('k')).toBe('correct');
  });

  it('jednou zelené písmeno už nezešedne', () => {
    let state = new Map<string, LetterResult>([['a', 'correct']]);
    state = mergeKeyboardState(state, 'abcde', ['absent', 'absent', 'absent', 'absent', 'absent']);
    expect(state.get('a')).toBe('correct');
  });

  it('šedá se zapíše, když nic lepšího není', () => {
    const state = mergeKeyboardState(new Map(), 'xyzwq', ['absent', 'absent', 'absent', 'absent', 'absent']);
    expect(state.get('x')).toBe('absent');
  });
});

describe('checkHardMode', () => {
  const guesses = ['kolik'];
  const results = [evaluateGuess('kolik', 'kobyl')];

  it('projde tip, který používá všechny nápovědy', () => {
    // 'kolik' vs 'kobyl': k=correct, o=correct, l=present, i=absent, k=absent
    expect(checkHardMode('kobyl', guesses, results)).toBeNull();
  });

  it('zachytí vynechané zelené písmeno', () => {
    const violation = checkHardMode('babyl', guesses, results);
    expect(violation?.kind).toBe('missing-correct');
    expect(violation?.letter).toBe('k');
  });

  it('zachytí vynechané žluté písmeno', () => {
    const violation = checkHardMode('kozmy', guesses, results);
    expect(violation?.kind).toBe('missing-present');
    expect(violation?.letter).toBe('l');
  });

  it('bez předchozích tipů projde cokoliv', () => {
    expect(checkHardMode('cokol', [], [])).toBeNull();
  });
});

describe('shareGrid', () => {
  it('neobsahuje žádné písmeno tajného slova', () => {
    const results = [evaluateGuess('kolik', 'kobyl'), evaluateGuess('kobyl', 'kobyl')];
    const grid = shareGrid(results, 42, true);
    expect(grid).toContain('Pětipísmenka #42 2/6');
    // Ve sdílené mřížce nesmí být ani tajné slovo, ani žádný z tipů.
    expect(grid).not.toMatch(/kobyl|kolik/i);
    expect(grid).toContain('🟩');
  });

  it('u prohry ukáže X', () => {
    const results = Array.from({ length: MAX_GUESSES }, () => evaluateGuess('aaaaa', 'bbbbb'));
    expect(shareGrid(results, 7, false)).toContain('X/6');
  });
});

describe('colorblind symboly', () => {
  it('každý stav má vlastní symbol', () => {
    const glyphs = Object.values(RESULT_GLYPHS);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
});
