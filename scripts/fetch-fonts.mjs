#!/usr/bin/env node
/**
 * Stáhne a self-hostuje písma (D-011).
 *
 * Portál nesmí načítat nic z cizího originu: CSP nemá `fonts.googleapis.com`
 * a načítání písem z CDN je navíc problém podle GDPR. Skript proto stáhne
 * variabilní .woff2 a licence do `apps/portal/public/fonts`.
 *
 * Spouští se jednou při přípravě prostředí, ne při každém buildu — soubory
 * písem se commitují, aby build nezávisel na síti.
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(import.meta.dirname, '../apps/portal/public/fonts');

/**
 * Každé písmo má licenci OFL 1.1, která vyžaduje, aby se text licence
 * šířil spolu se soubory.
 */
const FONTS = [
  {
    name: 'BricolageGrotesque',
    css: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800',
    license: 'https://raw.githubusercontent.com/ateliertriay/bricolage/main/OFL.txt',
  },
  {
    name: 'AtkinsonHyperlegibleNext',
    css: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@200..800',
    license: 'https://raw.githubusercontent.com/googlefonts/atkinson-hyperlegible/main/OFL.txt',
  },
  {
    name: 'PixelifySans',
    css: 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700',
    license: 'https://raw.githubusercontent.com/eifetx/Pixelify-Sans/main/OFL.txt',
  },
];

// Bez tohohle vrátí Google CSS s .ttf místo .woff2.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

async function fetchText(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return response.text();
}

async function fetchBinary(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const faces = [];

  for (const font of FONTS) {
    process.stdout.write(`${font.name}… `);
    const css = await fetchText(font.css, { 'User-Agent': UA });

    // Bereme jen latin a latin-ext: čeština víc nepotřebuje a cyrilice
    // by zbytečně zvětšila stažené soubory.
    const blocks = css.split('/*').filter((b) => /latin(-ext)?\s*\*\//.test(b));
    let index = 0;

    for (const block of blocks) {
      const urlMatch = /src:\s*url\((https:[^)]+\.woff2)\)/.exec(block);
      const rangeMatch = /unicode-range:\s*([^;]+);/.exec(block);
      if (!urlMatch) continue;

      const subset = /latin-ext/.test(block) ? 'latin-ext' : 'latin';
      const file = `${font.name}-${subset}-${index++}.woff2`;
      writeFileSync(resolve(OUT, file), await fetchBinary(urlMatch[1]));

      faces.push({
        family: font.name.replace(/([a-z])([A-Z])/g, '$1 $2'),
        file,
        range: rangeMatch?.[1]?.trim(),
      });
    }

    writeFileSync(resolve(OUT, `OFL-${font.name}.txt`), await fetchText(font.license));
    console.log('hotovo');
  }

  const css = faces.map((face) => `@font-face {
  font-family: '${face.family}';
  font-style: normal;
  font-weight: 200 800;
  font-display: swap;
  src: url('/fonts/${face.file}') format('woff2');${face.range ? `\n  unicode-range: ${face.range};` : ''}
}`).join('\n\n');

  writeFileSync(
    resolve(OUT, 'fonts.css'),
    `/* Generováno scripts/fetch-fonts.mjs — needitovat ručně. */\n\n${css}\n`,
  );

  console.log(`\n✓ ${faces.length} řezů v ${OUT}`);
}

if (!existsSync(OUT) || process.argv.includes('--force')) {
  main().catch((error) => {
    console.error('Stažení písem selhalo:', error.message);
    console.error('Portál poběží na systémovém fallbacku z tokenů.');
    process.exit(1);
  });
} else {
  console.log('Písma už existují. Přepsat: --force');
}
