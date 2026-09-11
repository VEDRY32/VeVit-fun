import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const RULES = resolve(import.meta.dirname, '..');

/**
 * Každá hra se importuje jako `@vevit-games/rules/<slug>` (D-013), což
 * vyžaduje `index.ts` v jejím adresáři. Bez něj se hra nepřeloží — a bez
 * tohoto testu se na to přijde až při buildu portálu.
 */
describe('struktura balíčku rules', () => {
  const gameDirs = readdirSync(RULES).filter((entry) => {
    const full = resolve(RULES, entry);
    return statSync(full).isDirectory() && entry !== '__tests__';
  });

  it('najde adresáře her', () => {
    expect(gameDirs.length).toBeGreaterThan(10);
  });

  it.each(gameDirs)('hra %s má vlastní index.ts', (dir) => {
    expect(existsSync(resolve(RULES, dir, 'index.ts'))).toBe(true);
  });

  it.each(gameDirs)('hra %s nemá vlastní adresář testů bez testů', (dir) => {
    const tests = resolve(RULES, dir, '__tests__');
    if (!existsSync(tests)) return;
    const files = readdirSync(tests).filter((f) => f.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(0);
  });
});
