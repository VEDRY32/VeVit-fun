/** Pexeso — 3D otočení karty, vlastní vektorové ilustrace. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, roundRect, centerText, withAlpha, clamp01,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import { createPexeso, MOTIFS, type MotifSet, type PexesoConfig } from '@vevit-games/rules/pexeso';
import { manifest } from './manifest.js';
import { drawMotif } from './motifs.js';

const VIEW_W = 640;
const VIEW_H = 680;
const HEADER = 64;

/** Barvy motivů — dost odlišné i pro poruchy barvocitu. */
const MOTIF_COLORS = [herniPaleta.indigo, herniPaleta.zelena, herniPaleta.zluta, herniPaleta.ruzova, herniPaleta.fialova, herniPaleta.tyrkys, herniPaleta.zluta, herniPaleta.tyrkys];

const MODE_CONFIG: Record<string, Partial<PexesoConfig>> = {
  mala: { rows: 4, cols: 4 },
  stredni: { rows: 6, cols: 6 },
  velka: { rows: 8, cols: 8 },
  'dva-hraci': { rows: 6, cols: 6, players: 2 },
};

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  a: ['Space', 'Enter'],
};

export const controlHints = [
  { action: 'pointer', label: 'Otočit kartu', keys: 'klik / tap' },
  { action: 'left', label: 'Kurzor', keys: '← ↑ → ↓' },
  { action: 'a', label: 'Otočit kurzorem', keys: 'mezerník' },
];

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);

  const cols = 4;
  const rows = 3;
  const cell = Math.min(width / (cols + 0.6), height / (rows + 0.6));
  const originX = (width - cols * cell) / 2;
  const originY = (height - rows * cell) / 2;
  const motifs = MOTIFS.zvirata;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      // Karty se postupně otáčejí a zase zavírají — klidná smyčka.
      const phase = (t * 0.9 - index * 0.25) % 4;
      const flip = phase < 0 ? 0 : clamp01(phase < 2 ? phase : 4 - phase);
      const scaleX = Math.abs(Math.cos(flip * Math.PI));
      const faceUp = flip > 0.5;

      const x = originX + col * cell + 3;
      const y = originY + row * cell + 3;
      const size = cell - 6;

      c.save();
      c.translate(x + size / 2, y + size / 2);
      c.scale(Math.max(0.04, scaleX), 1);
      c.fillStyle = faceUp ? paleta.text : paleta.linka;
      roundRect(c, -size / 2, -size / 2, size, size, 7);
      c.fill();
      if (faceUp) {
        drawMotif(c, motifs[index % motifs.length]!, -size / 2, -size / 2, size,
          MOTIF_COLORS[index % MOTIF_COLORS.length]!);
      }
      c.restore();
    }
  }
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;
  const config = MODE_CONFIG[ctx.mode] ?? MODE_CONFIG.mala!;
  const motifSet: MotifSet = 'zvirata';

  const makeGame = () => createPexeso(ctx.seed, { ...config, motifs: motifSet });
  let game = makeGame();
  let finished = false;
  // Fáze otočení pro každou kartu; drží plynulou animaci nezávisle na logice.
  let flips = new Float32Array(game.state.cards.length);
  let cursor = 0;
  let showCursor = false;

  const { rows, cols } = game.config;
  const available = Math.min(VIEW_W - 24, VIEW_H - HEADER - 24);
  const cell = Math.min(available / cols, available / rows);
  const boardW = cell * cols;
  const boardH = cell * rows;
  const originX = (VIEW_W - boardW) / 2;
  const originY = HEADER + (VIEW_H - HEADER - boardH) / 2;

  const colorFor = (motif: string): string => {
    let hash = 0;
    for (const char of motif) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    return MOTIF_COLORS[Math.abs(hash) % MOTIF_COLORS.length]!;
  };

  const indexAt = (px: number, py: number): number => {
    const col = Math.floor((px - originX) / cell);
    const row = Math.floor((py - originY) / cell);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return -1;
    return row * cols + col;
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('win');
    const durationMs = game.elapsedMs();
    const twoPlayers = game.config.players > 1;
    const score = twoPlayers ? (game.state.scores[0] ?? 0) : durationMs;

    if (!twoPlayers) {
      void ctx.scores.submit({
        runId: null, mode: ctx.mode, score, durationMs,
        stats: { tahy: game.state.moves },
      });
    }
    ctx.emit({ type: 'win', score, durationMs, stats: { tahy: game.state.moves } });
  };

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    // Hlavička: tahy a čas, u dvou hráčů skóre obou.
    c.textBaseline = 'middle';
    if (game.config.players > 1) {
      for (let player = 0; player < game.config.players; player++) {
        const active = game.state.currentPlayer === player;
        const x = player === 0 ? 24 : VIEW_W - 24;
        c.textAlign = player === 0 ? 'left' : 'right';
        c.font = `${active ? '700' : '500'} 18px system-ui, sans-serif`;
        c.fillStyle = active ? ctx.theme.accent : ctx.theme.textMuted;
        c.fillText(`Hráč ${player + 1}: ${game.state.scores[player] ?? 0}`, x, HEADER / 2);
      }
    } else {
      c.textAlign = 'left';
      c.font = '500 15px system-ui, sans-serif';
      c.fillStyle = ctx.theme.textMuted;
      c.fillText(`Tahy ${game.state.moves}`, 24, HEADER / 2);
      c.textAlign = 'right';
      c.fillStyle = ctx.theme.text;
      c.font = '600 18px system-ui, sans-serif';
      c.fillText(`${(game.elapsedMs() / 1000).toFixed(1)} s`, VIEW_W - 24, HEADER / 2);
    }

    for (let index = 0; index < game.state.cards.length; index++) {
      const card = game.state.cards[index]!;
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = originX + col * cell + 4;
      const y = originY + row * cell + 4;
      const size = cell - 8;

      const flip = flips[index] ?? 0;
      const scaleX = ctx.theme.reducedMotion
        ? 1
        : Math.max(0.04, Math.abs(Math.cos(flip * Math.PI)));
      const showFace = ctx.theme.reducedMotion ? (card.flipped || card.matched) : flip > 0.5;

      c.save();
      c.translate(x + size / 2, y + size / 2);
      c.scale(scaleX, 1);

      if (showFace) {
        c.fillStyle = card.matched ? withAlpha(paleta.text, 0.55) : paleta.text;
        roundRect(c, -size / 2, -size / 2, size, size, 8);
        c.fill();
        drawMotif(c, card.motif, -size / 2, -size / 2, size, colorFor(card.motif));
      } else {
        c.fillStyle = ctx.theme.surface;
        roundRect(c, -size / 2, -size / 2, size, size, 8);
        c.fill();
        // Rub s motivem VeVit: čtyři kostičky.
        c.fillStyle = withAlpha(ctx.theme.accent, 0.45);
        const dot = size * 0.11;
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          roundRect(c, dx * size * 0.15 - dot / 2, dy * size * 0.15 - dot / 2, dot, dot, 2);
          c.fill();
        }
      }
      c.restore();

      if (showCursor && index === cursor) {
        c.strokeStyle = ctx.theme.accent;
        c.lineWidth = 3;
        roundRect(c, x - 2, y - 2, size + 4, size + 4, 9);
        c.stroke();
      }
    }

    if (game.state.over && game.config.players > 1) {
      const winner = game.winner();
      centerText(
        c,
        winner == null ? 'Remíza' : `Vyhrál hráč ${winner + 1}`,
        VIEW_W / 2, VIEW_H - 24,
        '600 22px system-ui, sans-serif', ctx.theme.accent,
      );
    }
  };

  const flipCard = (index: number): void => {
    const before = game.state.cards[index]?.matched;
    if (game.flip(index)) {
      ctx.audio.play('click');
      if (!before && game.state.cards[index]!.matched) ctx.audio.play('pickup');
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    const local = surface.toLogical(e.clientX, e.clientY);
    const index = indexAt(local.x, local.y);
    if (index >= 0) flipCard(index);
  };
  surface.canvas.addEventListener('pointerup', onPointerUp);

  const loop = createLoop(
    {
      update() {
        input.sample();
        game.tick();

        // Animace otáčení dohání logický stav.
        for (let i = 0; i < flips.length; i++) {
          const card = game.state.cards[i]!;
          const target = card.flipped || card.matched ? 1 : 0;
          const current = flips[i] ?? 0;
          flips[i] = current + Math.sign(target - current) * Math.min(0.14, Math.abs(target - current));
        }

        if (input.pressed('left')) { cursor = Math.max(0, cursor - 1); showCursor = true; }
        if (input.pressed('right')) { cursor = Math.min(flips.length - 1, cursor + 1); showCursor = true; }
        if (input.pressed('up')) { cursor = Math.max(0, cursor - cols); showCursor = true; }
        if (input.pressed('down')) { cursor = Math.min(flips.length - 1, cursor + cols); showCursor = true; }
        if (input.pressed('a')) flipCard(cursor);

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
    destroy() {
      loop.stop();
      surface.canvas.removeEventListener('pointerup', onPointerUp);
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, controlHints };
