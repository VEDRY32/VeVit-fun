/** Zdvojka — vykreslení a napojení pravidel na engine. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createReplayRecorder, roundRect, centerText,
  withAlpha, easing, clamp01,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import { createZdvojka, type ZdvojkaMode, type Direction } from '@vevit-games/rules/zdvojka';
import { manifest } from './manifest.js';

const VIEW_W = 480;
const VIEW_H = 560;
const BOARD_PAD = 12;
const BOARD_TOP = 120;

/**
 * Škála od studené k teplé — vyšší číslo, teplejší dlaždice.
 * Hodnoty do 64 jsou tmavé (bílý popisek), od 128 svítivé (tmavý popisek);
 * hranici drží `LIGHT_FROM` níž, aby text na dlaždici zůstal čitelný.
 */
const TILE_COLORS: Record<number, string> = {
  2: '#1F2937', 4: '#2A323C', 8: '#333C48', 16: herniPaleta.kamen,
  32: '#4B5563', 64: '#5B6472', 128: herniPaleta.zluta, 256: herniPaleta.oranzova,
  512: herniPaleta.cervena, 1024: herniPaleta.ruzova, 2048: herniPaleta.zelena,
};

/** Od téhle hodnoty výš je dlaždice svítivá a popisek na ní musí být tmavý. */
const LIGHT_FROM = 128;

const colorFor = (value: number): string => TILE_COLORS[value] ?? herniPaleta.tyrkys;

/** Animace přesunu trvá ~110 ms; při 60 Hz je to sedm kroků. */
const MOVE_TICKS = 7;

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  b: ['KeyZ'],
};

/**
 * Zdvojka se hlavně ovládá švihem, takže kříž je jen doplněk.
 * Leží v horním pruhu nad mřížkou, kde nic nepřekrývá.
 */
export const touchButtons = [
  { action: 'left', label: '◀', x: 40, y: 14, size: 52 },
  { action: 'up', label: '▲', x: 52, y: 8, size: 52 },
  { action: 'down', label: '▼', x: 52, y: 20, size: 52 },
  { action: 'right', label: '▶', x: 64, y: 14, size: 52 },
];

export const controlHints = [
  { action: 'left', label: 'Posun dlaždic', keys: '← ↑ → ↓' },
  { action: 'b', label: 'Krok zpět (pohodový)', keys: 'Z' },
];

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.fillStyle = paleta.noc;
  ctx.fillRect(0, 0, width, height);

  const size = Math.min(width, height) * 0.86;
  const cell = size / 4;
  const originX = (width - size) / 2;
  const originY = (height - size) / 2;

  ctx.fillStyle = paleta.pult;
  roundRect(ctx, originX - 4, originY - 4, size + 8, size + 8, 10);
  ctx.fill();

  // Deterministická ukázka: hodnoty se posouvají podle času.
  const phase = Math.floor(t) % 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const step = (x + y * 2 + phase) % 7;
      if (step > 5) continue;
      const value = 2 ** (step + 1);
      const px = originX + x * cell + 3;
      const py = originY + y * cell + 3;
      ctx.fillStyle = colorFor(value);
      roundRect(ctx, px, py, cell - 6, cell - 6, 6);
      ctx.fill();
      centerText(
        ctx, String(value), px + (cell - 6) / 2, py + (cell - 6) / 2,
        `600 ${Math.round(cell * 0.32)}px system-ui, sans-serif`,
        value >= LIGHT_FROM ? paleta.noc : paleta.text,
      );
    }
  }
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W,
    logicalHeight: VIEW_H,
    letterbox: ctx.theme.background,
  });
  const { input } = ctx;
  const mode = ctx.mode as ZdvojkaMode;

  const makeGame = () =>
    createZdvojka(ctx.seed, {
      mode,
      timeLimitTicks: mode === 'casovka' ? 3 * 60 * 60 : 0,
    });

  let game = makeGame();
  let recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let moveAnim = 0;
  let lastScore = 0;

  // Mřížka musí být čtvercová a vejít se i na výšku — jinak poslední řádek
  // zmizí pod spodní hranou plátna.
  const size = Math.min(VIEW_W - BOARD_PAD * 2, VIEW_H - BOARD_TOP - BOARD_PAD);
  const boardX = (VIEW_W - size) / 2;
  const cellSize = size / game.config.size;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('lose');
    void ctx.scores.submit({
      runId: null, mode,
      score: game.state.score,
      durationMs: Math.round((game.state.tick * 1000) / 60),
      replay: recorder.finish(),
      stats: { tahy: game.state.moves, nejvyssi: game.state.best },
    });
    ctx.emit({
      type: 'gameover',
      score: game.state.score,
      durationMs: Math.round((game.state.tick * 1000) / 60),
      stats: { tahy: game.state.moves, nejvyssi: game.state.best },
    });
  };

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    // Hlavička se skóre a rekordem.
    c.fillStyle = ctx.theme.textMuted;
    c.font = '500 12px system-ui, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillText('SKÓRE', boardX, 26);
    c.fillText('TAHY', VIEW_W - boardX - 60, 26);

    c.fillStyle = ctx.theme.text;
    c.font = '600 34px system-ui, sans-serif';
    c.fillText(game.state.score.toLocaleString('cs-CZ'), boardX, 44);
    c.font = '600 20px system-ui, sans-serif';
    c.fillText(String(game.state.moves), VIEW_W - boardX - 60, 46);

    // Podklad mřížky.
    c.fillStyle = ctx.theme.surface;
    roundRect(c, boardX, BOARD_TOP, size, size, 12);
    c.fill();

    for (let y = 0; y < game.config.size; y++) {
      for (let x = 0; x < game.config.size; x++) {
        c.fillStyle = withAlpha(ctx.theme.text, 0.05);
        roundRect(
          c,
          boardX + x * cellSize + 5, BOARD_TOP + y * cellSize + 5,
          cellSize - 10, cellSize - 10, 7,
        );
        c.fill();
      }
    }

    // Dlaždice. Přesun se interpoluje z `fromX/fromY`, sloučení dostane „pop".
    const progress = clamp01(1 - moveAnim / MOVE_TICKS);
    const eased = easing.outCubic(progress);

    for (const tile of game.state.tiles) {
      const tx = tile.fromX + (tile.x - tile.fromX) * eased;
      const ty = tile.fromY + (tile.y - tile.fromY) * eased;
      let scale = 1;
      if (tile.spawned) scale = easing.outBack(progress);
      else if (tile.merged) scale = 1 + Math.sin(progress * Math.PI) * 0.12;

      const inset = 5 + (cellSize - 10) * (1 - scale) / 2;
      const px = boardX + tx * cellSize + inset;
      const py = BOARD_TOP + ty * cellSize + inset;
      const dim = (cellSize - 10) * scale;

      c.fillStyle = colorFor(tile.value);
      roundRect(c, px, py, dim, dim, 7);
      c.fill();

      const fontSize = tile.value >= 1024 ? cellSize * 0.26 : cellSize * 0.34;
      centerText(
        c, String(tile.value), px + dim / 2, py + dim / 2,
        `600 ${Math.round(fontSize)}px system-ui, sans-serif`,
        tile.value >= LIGHT_FROM ? paleta.noc : paleta.text,
      );
    }

    if (mode === 'casovka') {
      const remaining = Math.max(0, 3 * 60 * 60 - game.state.tick);
      const seconds = Math.ceil(remaining / 60);
      centerText(
        c, `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
        VIEW_W / 2, 54, '600 26px system-ui, sans-serif', ctx.theme.accent,
      );
    }
  };

  const applyMove = (direction: Direction): void => {
    if (game.move(direction)) {
      moveAnim = MOVE_TICKS;
      ctx.audio.play('move');
    }
  };

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();
        const mask = input.snapshot();
        recorder.record(mask);

        if (moveAnim > 0) moveAnim--;

        const before = game.state.moves;
        game.step(mask);
        if (game.state.moves !== before) {
          moveAnim = MOVE_TICKS;
          ctx.audio.play('move');
        }

        if (input.pressed('b')) game.undo();

        if (game.state.score !== lastScore) {
          lastScore = game.state.score;
          ctx.emit({ type: 'score', value: lastScore });
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

  // Švih prstem — pohodlnější než virtuální kříž.
  let swipeStart: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent): void => {
    swipeStart = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent): void => {
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    swipeStart = null;
    // Krátký tah je spíš překliknutí než gesto.
    if (Math.hypot(dx, dy) < 28) return;
    applyMove(
      Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up'),
    );
  };
  surface.canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);

  loop.start();
  ctx.emit({ type: 'ready' });
  ctx.emit({ type: 'started' });

  return {
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    destroy() {
      loop.stop();
      surface.canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      surface.destroy();
    },
    getSave: () => ({ tiles: game.state.tiles, score: game.state.score, moves: game.state.moves }),
    loadSave(data) {
      const save = data as { tiles?: unknown; score?: number; moves?: number } | null;
      if (!save?.tiles || !Array.isArray(save.tiles)) return false;
      game.state.tiles = save.tiles as typeof game.state.tiles;
      game.state.score = save.score ?? 0;
      game.state.moves = save.moves ?? 0;
      return true;
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, touchButtons, controlHints };
