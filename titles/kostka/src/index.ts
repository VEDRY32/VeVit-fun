/** Kostka — převalující se kvádr nad dlaždicovým ostrovem. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createReplayRecorder, roundRect, centerText, withAlpha, easing,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createKostka, LEVELS, FALL_TICKS,
  type KostkaGame, type Tile, type Dir,
} from '@vevit-games/rules/kostka';
import { manifest } from './manifest.js';

const VIEW_W = 640;
const VIEW_H = 520;
const HEADER = 56;
const CELL = 40;
/** Výška kvádru nastojato; naležato je poloviční. */
const BLOCK_RISE = 26;

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  b: ['KeyR'],
};

export const touchButtons = [
  { action: 'left', label: '←', x: 12, y: 78 },
  { action: 'right', label: '→', x: 30, y: 78 },
  { action: 'up', label: '↑', x: 80, y: 66 },
  { action: 'down', label: '↓', x: 80, y: 88 },
];

export const controlHints = [
  { action: 'left', label: 'Převalit kostku', keys: '← ↑ → ↓' },
  { action: 'b', label: 'Úroveň znovu', keys: 'R' },
];

const TILE_COLORS: Record<Tile, string> = {
  prazdno: 'transparent',
  pevna: paleta.pultSvetly,
  krehka: herniPaleta.zluta,
  spinac: herniPaleta.tyrkys,
  most: herniPaleta.fialova,
  cil: herniPaleta.zelena,
};

/** Vykreslí jednu dlaždici i s bočnicí, aby deska měla tloušťku. */
function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, tile: Tile, broken: boolean, bridgeOn: boolean,
): void {
  if (tile === 'prazdno') return;
  if (tile === 'krehka' && broken) return;
  if (tile === 'most' && !bridgeOn) {
    // Vypnutý most je jen obrys — hráč má vidět, kudy by cesta vedla.
    ctx.strokeStyle = withAlpha(TILE_COLORS.most, 0.35);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    roundRect(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 5);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  ctx.fillStyle = withAlpha(paleta.noc, 0.55);
  roundRect(ctx, x + 2, y + 6, CELL - 4, CELL - 4, 6);
  ctx.fill();

  ctx.fillStyle = TILE_COLORS[tile];
  roundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 6);
  ctx.fill();

  if (tile === 'cil') {
    // Cíl je díra: tmavý kotouč se světlým okrajem.
    ctx.fillStyle = paleta.noc;
    ctx.beginPath();
    ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  if (tile === 'spinac') {
    ctx.fillStyle = paleta.noc;
    ctx.beginPath();
    ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  if (tile === 'krehka') {
    // Prasklina naznačí, že dlaždice nevydrží stojící kostku.
    ctx.strokeStyle = withAlpha(paleta.noc, 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + CELL - 10);
    ctx.lineTo(x + CELL / 2, y + 12);
    ctx.lineTo(x + CELL - 8, y + CELL - 8);
    ctx.stroke();
  }
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  cells: { x: number; y: number }[],
  originX: number, originY: number,
  accent: string, drop: number,
): void {
  const standing = cells.length === 1;
  const rise = (standing ? BLOCK_RISE : BLOCK_RISE * 0.45) * (1 - drop);
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxX = Math.max(...cells.map((c) => c.x));
  const maxY = Math.max(...cells.map((c) => c.y));

  const x = originX + minX * CELL + 4;
  const y = originY + minY * CELL + 4;
  const w = (maxX - minX + 1) * CELL - 8;
  const h = (maxY - minY + 1) * CELL - 8;

  // Stín pod kostkou se s pádem zmenšuje.
  ctx.fillStyle = withAlpha(paleta.noc, 0.45 * (1 - drop));
  roundRect(ctx, x + 3, y + 5, w, h, 6);
  ctx.fill();

  ctx.fillStyle = withAlpha(accent, 0.55);
  roundRect(ctx, x, y - rise + 6, w, h, 6);
  ctx.fill();

  ctx.fillStyle = accent;
  roundRect(ctx, x, y - rise, w, h, 6);
  ctx.fill();

  // Světlá hrana nahoře dává kvádru objem.
  ctx.strokeStyle = withAlpha('#ffffff', 0.35 * (1 - drop));
  ctx.lineWidth = 2;
  roundRect(ctx, x + 2, y - rise + 2, w - 4, h - 4, 5);
  ctx.stroke();
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);

  const rows = 5;
  const cols = 8;
  const scale = Math.min(width / (cols * CELL + 40), height / (rows * CELL + 40));
  c.save();
  c.translate((width - cols * CELL * scale) / 2, (height - rows * CELL * scale) / 2);
  c.scale(scale, scale);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile: Tile = x === cols - 2 && y === rows - 2 ? 'cil' : 'pevna';
      drawTile(c, x * CELL, y * CELL, tile, false, true);
    }
  }

  // Kostka obchází desku dokola: stojí, lehne si, znovu se postaví.
  const phase = Math.floor(t * 1.4) % 4;
  const cells = phase % 2 === 0
    ? [{ x: 1 + phase / 2, y: 1 }]
    : [{ x: 1 + (phase - 1) / 2, y: 1 }, { x: 2 + (phase - 1) / 2, y: 1 }];
  drawBlock(c, cells, 0, 0, herniPaleta.tyrkys, 0);
  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const game: KostkaGame = createKostka(ctx.seed);
  let recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode: ctx.mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let lastLevel = game.state.level;
  let lastMoves = 0;

  const origin = (): { x: number; y: number } => ({
    x: (VIEW_W - game.state.width * CELL) / 2,
    y: HEADER + (VIEW_H - HEADER - game.state.height * CELL) / 2,
  });

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('win');
    const durationMs = game.state.tick * (1000 / 60);
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score: game.state.totalMoves, durationMs,
      replay: recorder.finish(),
      stats: { urovne: LEVELS.length },
    });
    ctx.emit({
      type: 'win', score: game.state.totalMoves, durationMs,
      stats: { tahy: game.state.totalMoves },
    });
  };

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    const spec = LEVELS[game.state.level];
    c.font = '500 14px system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText(`Úroveň ${game.state.level + 1}/${LEVELS.length} · ${spec?.name ?? ''}`, 18, HEADER / 2);

    c.textAlign = 'right';
    c.fillStyle = game.state.moves > (spec?.par ?? 0) ? ctx.theme.textMuted : ctx.theme.accent;
    c.fillText(`Tahy ${game.state.moves} / ${spec?.par ?? 0}`, VIEW_W - 18, HEADER / 2);

    const { x: ox, y: oy } = origin();
    for (let y = 0; y < game.state.height; y++) {
      for (let x = 0; x < game.state.width; x++) {
        const i = game.index(x, y);
        drawTile(
          c, ox + x * CELL, oy + y * CELL,
          game.state.tiles[i]!, game.state.broken[i]!, game.state.bridgeOn[i]!,
        );
      }
    }

    // Pád: kostka se propadne a zmenší. Při vypnutém pohybu jen zmizí.
    const fall = game.state.fallTicks > 0
      ? easing.inQuad(1 - game.state.fallTicks / FALL_TICKS)
      : 0;
    const drop = ctx.theme.reducedMotion ? (fall > 0 ? 1 : 0) : fall;
    if (drop < 1) {
      drawBlock(c, game.blockCells(), ox, oy, ctx.theme.accent, drop);
    }

    if (game.state.won) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.86);
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      centerText(c, 'Všechny úrovně hotové', VIEW_W / 2, VIEW_H / 2 - 12,
        '600 30px system-ui, sans-serif', ctx.theme.accent);
      centerText(c, `${game.state.totalMoves} tahů celkem`, VIEW_W / 2, VIEW_H / 2 + 24,
        '500 16px system-ui, sans-serif', ctx.theme.textMuted);
    }
  };

  /** Klik nebo tap ve směru od kostky = tah tím směrem. */
  const onPointerUp = (e: PointerEvent): void => {
    if (game.state.won) return;
    const local = surface.toLogical(e.clientX, e.clientY);
    const { x: ox, y: oy } = origin();
    const cells = game.blockCells();
    const cx = ox + (cells.reduce((s, c) => s + c.x, 0) / cells.length + 0.5) * CELL;
    const cy = oy + (cells.reduce((s, c) => s + c.y, 0) / cells.length + 0.5) * CELL;
    const dx = local.x - cx;
    const dy = local.y - cy;
    if (Math.hypot(dx, dy) < CELL * 0.4) return;
    const dir: Dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
    if (game.move(dir)) ctx.audio.play('move');
  };
  surface.canvas.addEventListener('pointerup', onPointerUp);

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();
        const mask = input.snapshot();
        recorder.record(mask);

        const levelBefore = game.state.level;
        const movesBefore = game.state.moves;
        const solvedBefore = game.state.solved;
        const lostBefore = game.state.lost;

        game.step(mask);

        if (game.state.moves > movesBefore && game.state.level === levelBefore) {
          ctx.audio.play('move');
        }
        if (game.state.solved && !solvedBefore) ctx.audio.play('levelUp');
        if (game.state.lost && !lostBefore) ctx.audio.play('lose');
        if (game.state.level !== lastLevel) {
          lastLevel = game.state.level;
          ctx.audio.play('clear');
        }
        if (game.state.totalMoves !== lastMoves) {
          lastMoves = game.state.totalMoves;
          ctx.emit({ type: 'score', value: lastMoves });
        }
        if (game.state.won) finish();
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

export const module_: GameModule = {
  manifest, mount, renderAttract, keymap, touchButtons, controlHints,
};
