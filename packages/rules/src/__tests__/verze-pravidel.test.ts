/**
 * Verze pravidel je na dvou místech: v pravidlech (kvůli validaci replaye
 * na serveru) a v manifestu hry (kvůli lokálnímu úložišti a rekordům).
 * Když se rozejdou, server přijme běh, který klient počítal jinak.
 * Tenhle test je drží spolu.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RULES = resolve(import.meta.dirname, '..');
const TITLES = resolve(import.meta.dirname, '../../../../titles');

/** Přečte `… _RULES_VERSION = N` z pravidel dané hry. */
function rulesVersion(slug: string): number | null {
  const dir = join(RULES, slug);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts')) continue;
    const match = /_RULES_VERSION\s*=\s*(\d+)/.exec(readFileSync(join(dir, file), 'utf8'));
    if (match) return Number(match[1]);
  }
  return null;
}

function manifestVersion(slug: string): number | null {
  const path = join(TITLES, slug, 'src/manifest.ts');
  if (!existsSync(path)) return null;
  const match = /rulesVersion:\s*(\d+)/.exec(readFileSync(path, 'utf8'));
  return match ? Number(match[1]) : null;
}

const slugs = readdirSync(RULES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== '__tests__')
  .map((entry) => entry.name)
  .filter((slug) => existsSync(join(TITLES, slug, 'src/manifest.ts')));

describe('verze pravidel', () => {
  it('pokrývá všechny hry, které mají manifest', () => {
    expect(slugs.length).toBeGreaterThanOrEqual(16);
  });

  it.each(slugs)('%s má stejnou verzi v pravidlech i v manifestu', (slug) => {
    const rules = rulesVersion(slug);
    expect(rules, `${slug}: pravidla neuvádějí _RULES_VERSION`).not.toBeNull();
    expect(manifestVersion(slug), slug).toBe(rules);
  });
});
