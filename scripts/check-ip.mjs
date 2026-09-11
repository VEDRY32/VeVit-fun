#!/usr/bin/env node
/**
 * Kontrola duševního vlastnictví (D-012).
 * Projde repo a selže, pokud najde chráněný název originální hry.
 * Spouští se v CI před buildem.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// Chráněné názvy. Hledá se jako celé slovo, bez ohledu na velikost písmen.
const FORBIDDEN = [
  'tetris', 'wordle', 'pac-?man', 'pacman', 'street\\s*fighter', 'stick\\s*war',
  'candy\\s*crush', 'geometry\\s*dash', 'bloons', 'agar\\.?io', 'slither\\.?io',
  'skribbl', 'bomberman', 'worms', 'minesweeper', 'sokoban', 'doodle\\s*jump',
  'crossy\\s*road', 'flappy', 'breakout', 'arkanoid', 'space\\s*invaders',
  'asteroids', 'frogger', 'bejeweled', 'puzzle\\s*bobble', 'cookie\\s*clicker',
  'semantle', 'contexto', 'mahjong\\s*solitaire', 'gomoku', 'ludo',
  'connect\\s*four', 'typeracer', 'diep\\.?io', 'wormax',
];

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.turbo', '.vite',
  'playwright-report', 'test-results',
]);

// Soubory, kde smí chráněná slova být — protože právě definují zákaz.
const ALLOWLIST = new Set(['scripts/check-ip.mjs']);

const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.css',
  '.html', '.yml', '.yaml', '.sql', '.txt', '.sh',
]);

const patterns = FORBIDDEN.map((p) => ({
  source: p,
  re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${p})(?![\\p{L}\\p{N}])`, 'giu'),
}));

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (TEXT_EXT.has(extname(entry))) out.push(full);
  }
  return out;
}

const hits = [];
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (ALLOWLIST.has(rel)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const { source, re } of patterns) {
      re.lastIndex = 0;
      const m = re.exec(line);
      if (m) hits.push({ rel, line: i + 1, match: m[0], source, text: line.trim() });
    }
  });
}

if (hits.length > 0) {
  console.error(`\n✗ Nalezeno ${hits.length} chráněných názvů (D-012):\n`);
  for (const h of hits) {
    console.error(`  ${h.rel}:${h.line}  „${h.match}"`);
    console.error(`    ${h.text.slice(0, 120)}`);
  }
  console.error('\nPoužij název z katalogu v zadání. Popis smí mechaniku jen opsat.\n');
  process.exit(1);
}

console.log('✓ Kontrola duševního vlastnictví prošla.');
