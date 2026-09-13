/**
 * Offline stránka portálu.
 *
 * Není to chybová hláška, ale hratelný Běžec. Stránka je samostatný vstupní
 * bod: nesmí táhnout React ani shell portálu, protože se servíruje právě
 * tehdy, když nic dalšího stáhnout nejde.
 */

import { createLoop, createSurface, createInput, DEFAULT_KEYMAP } from '@vevit-games/engine';
import { createBezec, WORLD_W, WORLD_H } from '@vevit-games/rules/bezec';
import { drawBezec } from '@titles/bezec/src/render.js';

const BEST_KEY = 'vevit.games.bezec.best';

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

function saveBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Privátní režim — rekord se prostě neuloží.
  }
}

const host = document.getElementById('hra');
if (!host) throw new Error('Chybí #hra — offline.html je poškozený.');

const surface = createSurface(host, {
  logicalWidth: WORLD_W,
  logicalHeight: WORLD_H,
  letterbox: '#08090C',
});

const input = createInput({
  target: host,
  logicalWidth: WORLD_W,
  logicalHeight: WORLD_H,
  keymap: { ...DEFAULT_KEYMAP, a: ['Space'], up: ['ArrowUp'], down: ['ArrowDown'] },
});

let best = loadBest();
let game = createBezec(`offline:${Date.now()}`);
let finished = false;

const status = document.getElementById('stav');
const updateStatus = (): void => {
  if (!status) return;
  status.textContent = navigator.onLine
    ? 'Připojení je zpátky. Obnov stránku a hraj dál.'
    : 'Jsi offline. Než se připojíš, zkus Běžce.';
  status.classList.toggle('je-online', navigator.onLine);
};
updateStatus();
window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);

const loop = createLoop({
  update() {
    input.sample();
    if (finished) {
      if (input.pressed('a') || input.pressed('up')) {
        game = createBezec(`offline:${Date.now()}`);
        finished = false;
      }
      return;
    }
    game.step(input.snapshot());
    if (game.state.over) {
      finished = true;
      if (game.state.score > best) {
        best = game.state.score;
        saveBest(best);
      }
    }
  },
  render() {
    surface.begin();
    drawBezec(surface.ctx, game, { showHint: true, bestScore: best });
  },
});

// Tap kamkoliv skáče; spodní část plochy krčí.
host.addEventListener('pointerdown', (event) => {
  const local = surface.toLogical(event.clientX, event.clientY);
  input.setVirtual(local.y > WORLD_H * 0.6 ? 'down' : 'a', true);
});
window.addEventListener('pointerup', () => {
  input.setVirtual('a', false);
  input.setVirtual('down', false);
});

loop.start();
