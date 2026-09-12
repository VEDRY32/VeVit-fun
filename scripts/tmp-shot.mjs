import { chromium } from 'playwright';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  for (const e of readdirSync(root)) {
    if (!e.startsWith('chromium-')) continue;
    const c = join(root, e, 'chrome-linux', 'chrome');
    if (existsSync(c)) return c;
  }
}
mkdirSync('/tmp/claude-0/shots', { recursive: true });
const keys = (process.env.KEYS ?? 'ArrowUp,Space,ArrowDown').split(',');
const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
for (const g of process.argv.slice(2)) {
  await page.goto(`http://127.0.0.1:4173/cs/${g}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(700); }
  await page.waitForTimeout(900);
  await page.screenshot({ path: `/tmp/claude-0/shots/${g}.png` });
  console.log('ok', g);
}
console.log(errors.length ? `CHYBY: ${errors.join(' | ')}` : 'bez chyb v konzoli');
await browser.close();
