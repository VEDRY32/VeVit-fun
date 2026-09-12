#!/usr/bin/env node
/**
 * Kouřový test portálu přes skutečný prohlížeč.
 *
 * Projde domovskou stránku a každou hru: načtení, start, deset sekund
 * náhodných vstupů, pauza, pokračování. Selže na jakékoliv chybě v konzoli.
 * Do `screenshots/` odloží snímky pro desktop (1440) i mobil (390).
 */

import { chromium, devices } from 'playwright';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const OUT = process.env.SHOT_DIR ?? resolve(process.cwd(), 'screenshots');
const GAMES = [
  'kostkopad', 'petipismenka', 'zdvojka', 'had', 'hledac-min', 'pasiansy',
  'mavnik', 'pexeso', 'ctyri-v-rade', 'cihlobijec', 'invaze', 'hladovec', 'bezec', 'piskvorky', 'odpal', 'sudoku', 'kostka', 'lovec-uzemi', 'super-skokan', 'utek', 'posledni-obrana', 'ohen-a-voda', 'najezdnik', 'stastna-opice',
];

const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyX', 'KeyZ', 'KeyC'];

mkdirSync(OUT, { recursive: true });

let failures = 0;

/**
 * Chromium je v prostředí předinstalované, ale verze v názvu adresáře se
 * mění — hledáme ho, místo abychom cestu psali natvrdo.
 */
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium-')) continue;
    const candidate = join(root, entry, 'chrome-linux', 'chrome');
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** Sbírá chyby konzole a nezachycené výjimky pro jednu stránku. */
function watchErrors(page, label) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Chybějící favicon a přerušené fetch na API v testu bez serveru nejsou
    // chyby hry — API je záměrně nedostupné a portál to má ustát.
    if (/favicon|Failed to load resource/i.test(text)) return;
    errors.push(text);
  });
  page.on('pageerror', (error) => errors.push(`${error.name}: ${error.message}`));
  return () => {
    if (errors.length > 0) {
      failures++;
      console.error(`✗ ${label}: ${errors.length} chyb v konzoli`);
      for (const error of errors.slice(0, 5)) console.error(`    ${error}`);
    } else {
      console.log(`✓ ${label}`);
    }
    return errors.length === 0;
  };
}

async function run() {
  const browser = await chromium.launch({ executablePath: findChromium() });

  for (const [label, options] of [
    ['desktop', { viewport: { width: 1440, height: 900 } }],
    ['mobil', devices['Pixel 5']],
  ]) {
    const context = await browser.newContext(options);

    // --- Domovská stránka ---
    const home = await context.newPage();
    const checkHome = watchErrors(home, `${label} · domů`);
    await home.goto(`${BASE}/cs/`, { waitUntil: 'networkidle' });
    await home.waitForTimeout(1200);
    await home.screenshot({ path: `${OUT}/${label}-domu.png`, fullPage: label === 'desktop' });
    checkHome();

    // --- Offline stránka ---
    // Není to chybová hláška, ale hratelný Běžec; musí běžet bez portálu.
    const offline = await context.newPage();
    const checkOffline = watchErrors(offline, `${label} · offline`);
    await offline.goto(`${BASE}/offline.html`, { waitUntil: 'networkidle' });
    const offlineCanvas = await offline.waitForSelector('#hra canvas', { timeout: 8000 }).catch(() => null);
    if (!offlineCanvas) {
      failures++;
      console.error(`✗ ${label} · offline: plátno se neobjevilo`);
    } else {
      await offline.keyboard.press('Space');
      await offline.waitForTimeout(600);
      await offline.screenshot({ path: `${OUT}/${label}-offline.png` });
    }
    checkOffline();
    await offline.close();

    // --- Profil ---
    const profile = await context.newPage();
    const checkProfile = watchErrors(profile, `${label} · profil`);
    await profile.goto(`${BASE}/cs/profil`, { waitUntil: 'networkidle' });
    await profile.screenshot({ path: `${OUT}/${label}-profil.png` });
    checkProfile();
    await profile.close();

    // --- Nastavení ---
    const settings = await context.newPage();
    const checkSettings = watchErrors(settings, `${label} · nastavení`);
    await settings.goto(`${BASE}/cs/nastaveni`, { waitUntil: 'networkidle' });
    await settings.screenshot({ path: `${OUT}/${label}-nastaveni.png` });
    checkSettings();
    await settings.close();

    // --- Každá hra ---
    for (const slug of GAMES) {
      const page = await context.newPage();
      const check = watchErrors(page, `${label} · ${slug}`);
      await page.goto(`${BASE}/cs/${slug}`, { waitUntil: 'networkidle' });

      // Hra musí vykreslit plátno, jinak se nespustila.
      const canvas = await page.waitForSelector('.hra__host canvas', { timeout: 10_000 }).catch(() => null);
      if (!canvas) {
        failures++;
        console.error(`✗ ${label} · ${slug}: plátno se neobjevilo`);
        await page.close();
        continue;
      }

      // Herní plocha se už jednou smrskla na dva pixely kvůli CSS (položka
      // mřížky s auto marginem a absolutně pozicovaným obsahem). Plátno
      // přitom existovalo, takže to samotná kontrola výše nechytila.
      //
      // Kontrolujeme šířku a poměr stran proti manifestu, ne pevnou výšku:
      // Běžec je 640×240, takže na mobilu vyjde nízký úplně správně.
      const box = await page.locator('.hra__plocha').boundingBox();
      const declared = await page.locator('.hra__plocha').evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          w: Number(style.getPropertyValue('--pomer-w')),
          h: Number(style.getPropertyValue('--pomer-h')),
        };
      });

      if (!box || box.width < 200 || box.height < 80) {
        failures++;
        console.error(`✗ ${label} · ${slug}: herní plocha má nesmyslnou velikost ${JSON.stringify(box)}`);
      } else if (declared.w > 0 && declared.h > 0) {
        const want = declared.w / declared.h;
        const got = box.width / box.height;
        if (Math.abs(want - got) / want > 0.04) {
          failures++;
          console.error(
            `✗ ${label} · ${slug}: poměr stran ${got.toFixed(2)} neodpovídá manifestu ${want.toFixed(2)}`,
          );
        }
      }

      await page.mouse.click(700, 400);

      // Deset sekund náhodných, ale reprodukovatelných vstupů.
      let seed = 12345;
      const nextKey = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return KEYS[seed % KEYS.length];
      };
      const until = Date.now() + 10_000;
      while (Date.now() < until) {
        await page.keyboard.press(nextKey());
        await page.waitForTimeout(60);
      }

      await page.screenshot({ path: `${OUT}/${label}-${slug}.png` });

      // Pauza a pokračování.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const paused = await page.locator('[role="dialog"]').count();
      if (paused === 0) {
        failures++;
        console.error(`✗ ${label} · ${slug}: Escape nepauzoval`);
      } else if (label === 'desktop' && slug === 'kostkopad') {
        await page.screenshot({ path: `${OUT}/${label}-${slug}-pauza.png` });
      }
      await page.getByRole('button', { name: 'Pokračovat' }).click().catch(() => {});
      await page.waitForTimeout(300);

      check();
      await page.close();
    }

    await home.close();
    await context.close();
  }

  await browser.close();

  if (failures > 0) {
    console.error(`\n✗ ${failures} selhání.`);
    process.exit(1);
  }
  console.log('\n✓ Kouřový test portálu prošel.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
