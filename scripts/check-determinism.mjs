#!/usr/bin/env node
/**
 * Kontrola determinismu herní logiky (D-008, D-010).
 *
 * Server musí umět přehrát běh hráče na bit přesně. Jakmile se do herní
 * logiky dostane `Math.random` nebo `Date.now`, přestane to platit a
 * validace skóre je k ničemu.
 *
 * Kontroluje se:
 *   - packages/rules/**            — celá herní logika
 *   - titles/<slug>/src/**         — kromě vykreslování a attract módu
 *
 * Vykreslování smí sáhnout na `performance.now` (animace nejsou logika),
 * ale `Math.random` nesmí ani tam: jinak by se attract ukázky a screenshoty
 * lišily snímek od snímku.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const SKIP_DIRS = new Set(['node_modules', 'dist', '__tests__', '.git']);

/** Co se nesmí objevit a proč. */
const RULES = [
  {
    pattern: /\bMath\.random\s*\(/,
    message: 'Math.random — použij ctx.rng nebo createRng(seed).',
    // Platí i pro vykreslování: attract ukázky musí být reprodukovatelné.
    logicOnly: false,
  },
  {
    pattern: /\bDate\.now\s*\(/,
    message: 'Date.now — herní čas se počítá v krocích logiky.',
    logicOnly: true,
  },
  {
    pattern: /\bnew\s+Date\s*\(\s*\)/,
    message: 'new Date() — herní čas se počítá v krocích logiky.',
    logicOnly: true,
  },
  {
    pattern: /\bperformance\.now\s*\(/,
    message: 'performance.now — herní logika nesmí záviset na reálném čase.',
    logicOnly: true,
  },
];

/**
 * Soubory, kde je výjimka odůvodněná. Každá položka musí mít důvod —
 * prázdný seznam je lepší než seznam bez vysvětlení.
 */
const ALLOWLIST = new Map([
  [
    'titles/petipismenka/src/index.ts',
    'Nekonečný režim losuje slovo mimo hodnocený běh; denní režim jede ze seedu.',
  ],
  [
    'titles/bezec/src/index.ts',
    'Seed nového běhu po konci hry; samotná logika běhu je v rules a je deterministická.',
  ],
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (extname(entry) === '.ts') out.push(full);
  }
  return out;
}

/** Je soubor herní logika (na rozdíl od vykreslování)? */
function isLogic(rel) {
  if (rel.startsWith('packages/rules/')) return true;
  // V titulech je logika všechno kromě render/attract vrstvy.
  return /^titles\/[^/]+\/src\//.test(rel) && !/render|motifs|mazes/.test(rel);
}

const targets = [
  join(ROOT, 'packages/rules/src'),
  join(ROOT, 'titles'),
].flatMap((dir) => {
  try {
    return walk(dir);
  } catch {
    return [];
  }
});

const problems = [];

for (const file of targets) {
  const rel = relative(ROOT, file);
  const allowReason = ALLOWLIST.get(rel);
  const logic = isLogic(rel);
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, index) => {
    // Komentáře se nepočítají — zmínka v dokumentaci je v pořádku.
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    for (const rule of RULES) {
      if (!rule.pattern.test(code)) continue;
      if (rule.logicOnly && !logic) continue;
      if (allowReason) continue;
      problems.push({ rel, line: index + 1, message: rule.message, text: line.trim() });
    }
  });
}

if (problems.length > 0) {
  console.error(`\n✗ Determinismus porušen na ${problems.length} místech:\n`);
  for (const problem of problems) {
    console.error(`  ${problem.rel}:${problem.line}  ${problem.message}`);
    console.error(`    ${problem.text.slice(0, 110)}`);
  }
  console.error('\nBez determinismu nejde běh přehrát a validace skóre je k ničemu.\n');
  process.exit(1);
}

console.log(`✓ Kontrola determinismu prošla (${targets.length} souborů).`);
if (ALLOWLIST.size > 0) {
  console.log('  Zdůvodněné výjimky:');
  for (const [file, reason] of ALLOWLIST) console.log(`   · ${file} — ${reason}`);
}
