/**
 * Slovník je data, ne kód — a přesně proto se v něm chyba pozná až ve hře.
 * Test hlídá tvar (pět znaků, bez duplicit) a to, že běžné slovo, které
 * hráči nahlásili jako odmítnuté, hra bere.
 */

import { describe, expect, it } from 'vitest';
import { ANSWERS, ALLOWED, answerForDay } from '../data/words-cs.js';

describe('český slovník Pětipísmenky', () => {
  it('každé slovo má přesně pět znaků', () => {
    for (const word of ALLOWED) expect([...word].length, word).toBe(5);
  });

  it('nemá duplicity mezi odpověďmi', () => {
    expect(new Set(ANSWERS).size).toBe(ANSWERS.length);
  });

  it('je celý malými písmeny a bez mezer', () => {
    for (const word of ALLOWED) expect(word, word).toBe(word.toLowerCase().trim());
  });

  it('bere běžná slova jako tip', () => {
    for (const word of ['cihla', 'kniha', 'stroj', 'vejce', 'zlato']) {
      expect(ALLOWED.has(word), word).toBe(true);
    }
  });

  it('každá odpověď je zároveň přijímaný tip', () => {
    for (const word of ANSWERS) expect(ALLOWED.has(word), word).toBe(true);
  });

  it('denní slovo se opakuje až po vyčerpání seznamu', () => {
    expect(answerForDay(0)).toBe(ANSWERS[0]);
    expect(answerForDay(ANSWERS.length)).toBe(ANSWERS[0]);
    expect(answerForDay(5)).not.toBe(answerForDay(6));
  });
});
