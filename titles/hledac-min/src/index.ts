/** Hledač min — moderní vyvýšené dlaždice, čísla v paletě ověřené pro barvoslepé. */

import {
  createLoop, createSurface, roundRect, centerText, withAlpha, shade,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import { createHledacMin, DIFFICULTIES, type HledacConfig } from '@vevit-games/rules';
import { manifest } from './manifest.js';

const VIEW_W = 620;
const VIEW_H = 640;
const HEADER = 56;

/**
 * Barvy čísel. Nejsou jen odstíny jedné škály — sousední hodnoty se liší
 * i světlostí, takže jsou rozlišitelné i při poruše barvocitu.
 */
const NUMBER_COLORS = [
  '', '#8FA6FF', '#5FD9A0', '#FF9F45', '#C77DFF',
  '#FF6B81', '#4FD1E8', '#EEF2FF', '#A3B1D6',
];

const CONFIGS: Record<string, Partial<HledacConfig>> = {
  zacatecnik: DIFFICULTIES.zacatecnik,
  pokrocily: DIFFICULTIES.pokrocily,
  expert: DIFFICULTIES.expert,
  'bez-hadani': { ...DIFFICULTIES.zacatecnik, noGuessing: true },
};

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  a: ['Space'], b: ['KeyF'],
};

export const touchButtons = [
  { action: 'b', label: '⚑', x: 88, y: 88, size: 64 },
];

export const controlHints = [
  { action: 'pointer', label: 'Odkrýt pole', keys: 'klik' },
  { action: 'b', label: 'Vlajka', keys: 'pravý klik / F' },
  { action: 'left', label: 'Kurzor', keys: '← ↑ → ↓' },
  { action: 'a', label: 'Odkrýt kurzorem', keys: 'mezerník' },
];

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = '#0F1C3F';
  c.fillRect(0, 0, width, height);

  const cols = 9;
  const rows = 6;
  const cell = Math.min(width / (cols + 1), height / (rows + 1));
  const originX = (width - cols * cell) / 2;
  const originY = (height - rows * cell) / 2;

  // Odkrývání se rozlévá od středu — deterministicky, podle vzdálenosti.
  const wave = (t * 2.2) % 9;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const distance = Math.hypot(x - cols / 2, y - rows / 2);
      const revealed = distance < wave;
      const px = originX + x * cell + 1.5;
      const py = originY + y * cell + 1.5;
      const dim = cell - 3;

      if (revealed) {
        c.fillStyle = '#132349';
        roundRect(c, px, py, dim, dim, 3);
        c.fill();
        const noise = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        const number = noise < 0.45 ? 0 : Math.min(4, Math.ceil(noise * 4));
        if (number > 0) {
          centerText(
            c, String(number), px + dim / 2, py + dim / 2,
            `600 ${Math.round(cell * 0.5)}px system-ui, sans-serif`,
            NUMBER_COLORS[number]!,
          );
        }
      } else {
        c.fillStyle = '#24396E';
        roundRect(c, px, py, dim, dim, 3);
        c.fill();
      }
    }
  }
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;
  const config = CONFIGS[ctx.mode] ?? DIFFICULTIES.zacatecnik;

  const makeGame = () => createHledacMin(ctx.seed, config);
  let game = makeGame();
  let finished = false;

  // Dotykový režim: přepínač určuje, jestli tap odkrývá, nebo dává vlajku.
  let flagMode = false;
  let cursorX = 0;
  let cursorY = 0;
  let showCursor = false;

  const cell = Math.min(
    (VIEW_W - 24) / game.config.width,
    (VIEW_H - HEADER - 24) / game.config.height,
  );
  const boardW = cell * game.config.width;
  const boardH = cell * game.config.height;
  const originX = (VIEW_W - boardW) / 2;
  const originY = HEADER + (VIEW_H - HEADER - boardH) / 2;

  const toCell = (px: number, py: number): { x: number; y: number } | null => {
    const x = Math.floor((px - originX) / cell);
    const y = Math.floor((py - originY) / cell);
    if (x < 0 || y < 0 || x >= game.config.width || y >= game.config.height) return null;
    return { x, y };
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play(game.state.won ? 'win' : 'lose');
    const durationMs = game.elapsedMs();
    if (game.state.won) {
      void ctx.scores.submit({
        runId: null, mode: ctx.mode, score: durationMs, durationMs,
        stats: { miny: game.config.mines },
      });
      ctx.emit({ type: 'win', score: durationMs, durationMs });
    } else {
      ctx.emit({ type: 'gameover', score: durationMs, durationMs });
    }
  };

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    // Hlavička: zbývající miny, čas, přepínač vlajky.
    const remaining = game.config.mines - game.state.flagsUsed;
    c.font = '600 20px system-ui, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillStyle = ctx.theme.text;
    c.fillText(`⚑ ${remaining}`, 20, HEADER / 2);

    c.textAlign = 'right';
    c.fillText(`${(game.elapsedMs() / 1000).toFixed(1)} s`, VIEW_W - 20, HEADER / 2);

    c.textAlign = 'center';
    c.font = '500 13px system-ui, sans-serif';
    c.fillStyle = flagMode ? ctx.theme.accent : ctx.theme.textMuted;
    c.fillText(flagMode ? 'režim vlajky' : 'režim odkrývání', VIEW_W / 2, HEADER / 2);

    for (let y = 0; y < game.config.height; y++) {
      for (let x = 0; x < game.config.width; x++) {
        const index = game.index(x, y);
        const state = game.state.cells[index]!;
        const px = originX + x * cell;
        const py = originY + y * cell;
        const inset = 1;

        if (state === 'revealed') {
          c.fillStyle = game.state.explodedAt === index ? '#FF5F6D' : shade(ctx.theme.background, 0.06);
          roundRect(c, px + inset, py + inset, cell - inset * 2, cell - inset * 2, 3);
          c.fill();

          const count = game.state.counts[index]!;
          if (count === -1) {
            c.fillStyle = ctx.theme.background;
            c.beginPath();
            c.arc(px + cell / 2, py + cell / 2, cell * 0.26, 0, Math.PI * 2);
            c.fill();
          } else if (count > 0) {
            centerText(
              c, String(count), px + cell / 2, py + cell / 2,
              `600 ${Math.round(cell * 0.52)}px system-ui, sans-serif`,
              NUMBER_COLORS[count] ?? ctx.theme.text,
            );
          }
        } else {
          // Vyvýšená dlaždice: světlá hrana nahoře, tmavá dole.
          c.fillStyle = ctx.theme.surface;
          roundRect(c, px + inset, py + inset, cell - inset * 2, cell - inset * 2, 3);
          c.fill();
          c.strokeStyle = withAlpha('#ffffff', 0.12);
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(px + inset + 1, py + cell - inset - 1);
          c.lineTo(px + inset + 1, py + inset + 1);
          c.lineTo(px + cell - inset - 1, py + inset + 1);
          c.stroke();

          if (state === 'flagged') {
            centerText(c, '⚑', px + cell / 2, py + cell / 2,
              `600 ${Math.round(cell * 0.5)}px system-ui, sans-serif`, ctx.theme.accent);
          } else if (state === 'question') {
            centerText(c, '?', px + cell / 2, py + cell / 2,
              `600 ${Math.round(cell * 0.5)}px system-ui, sans-serif`, ctx.theme.textMuted);
          }
        }
      }
    }

    if (showCursor) {
      c.strokeStyle = ctx.theme.accent;
      c.lineWidth = 2;
      roundRect(c, originX + cursorX * cell, originY + cursorY * cell, cell, cell, 3);
      c.stroke();
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (game.state.over) return;
    const rect = surface.canvas.getBoundingClientRect();
    const local = surface.toLogical(e.clientX, e.clientY);
    if (rect.width === 0) return;

    // Klik do hlavičky přepíná režim vlajky (hlavně pro dotyk).
    if (local.y < HEADER) {
      flagMode = !flagMode;
      return;
    }

    const target = toCell(local.x, local.y);
    if (!target) return;

    const rightClick = e.button === 2;
    if (rightClick || flagMode) {
      game.toggleFlag(target.x, target.y);
      ctx.audio.play('tick');
      return;
    }

    const index = game.index(target.x, target.y);
    if (game.state.cells[index] === 'revealed') game.chord(target.x, target.y);
    else game.reveal(target.x, target.y);
    ctx.audio.play(game.state.over && !game.state.won ? 'hit' : 'click');
  };

  const onContextMenu = (e: Event): void => e.preventDefault();
  surface.canvas.addEventListener('pointerup', onPointerUp);
  surface.canvas.addEventListener('contextmenu', onContextMenu);

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();
        game.tick();

        // Ovládání klávesnicí — plnohodnotná alternativa k myši.
        if (input.pressed('left')) { cursorX = Math.max(0, cursorX - 1); showCursor = true; }
        if (input.pressed('right')) { cursorX = Math.min(game.config.width - 1, cursorX + 1); showCursor = true; }
        if (input.pressed('up')) { cursorY = Math.max(0, cursorY - 1); showCursor = true; }
        if (input.pressed('down')) { cursorY = Math.min(game.config.height - 1, cursorY + 1); showCursor = true; }
        if (input.pressed('a')) {
          const index = game.index(cursorX, cursorY);
          if (game.state.cells[index] === 'revealed') game.chord(cursorX, cursorY);
          else game.reveal(cursorX, cursorY);
          ctx.audio.play('click');
        }
        if (input.pressed('b')) {
          game.toggleFlag(cursorX, cursorY);
          ctx.audio.play('tick');
        }

        if (game.state.over) finish();
      },
      render() {
        surface.begin();
        draw();
      },
    },
    { onAutoPause: () => ctx.emit({ type: 'paused' }) },
  );

  loop.start();
  ctx.emit({ type: 'ready' });
  ctx.emit({ type: 'started' });

  return {
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    restart() {
      game = makeGame();
      finished = false;
      loop.resume();
      ctx.emit({ type: 'started' });
    },
    destroy() {
      loop.stop();
      surface.canvas.removeEventListener('pointerup', onPointerUp);
      surface.canvas.removeEventListener('contextmenu', onContextMenu);
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, touchButtons, controlHints };
