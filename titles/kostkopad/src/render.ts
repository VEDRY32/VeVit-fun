/** Vykreslování Kostkopádu. Vlastní vzhled — skleněné dlaždice na tmavém poli. */

import { glassTile, roundRect, withAlpha, centerText, shade, type ParticleSystem } from '@vevit-games/engine';
import {
  COLS, VISIBLE_ROWS, HIDDEN_ROWS, PIECE_COLORS, PIECE_GLYPHS, PIECE_SHAPES,
  type KostkopadGame, type PieceType,
} from '@vevit-games/rules';

export const VIEW_WIDTH = 640;
export const VIEW_HEIGHT = 720;
export const CELL = 30;
export const BOARD_X = 185;
export const BOARD_Y = 40;
export const BOARD_W = COLS * CELL;
export const BOARD_H = VISIBLE_ROWS * CELL;

const GARBAGE_COLOR = '#54608C';

export interface RenderTheme {
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  colorblind: boolean;
  lowQuality: boolean;
}

function cellColor(value: PieceType | 'G'): string {
  return value === 'G' ? GARBAGE_COLOR : PIECE_COLORS[value];
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, value: PieceType | 'G',
  alpha: number, colorblind: boolean,
): void {
  glassTile(ctx, x, y, CELL, cellColor(value), alpha);
  if (colorblind && value !== 'G') {
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(15,28,63,0.9)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(PIECE_GLYPHS[value], x + 4, y + 3);
    ctx.restore();
  }
}

/** Malý náhled tvaru pro okénka „držení" a „další". */
function drawPreviewPiece(
  ctx: CanvasRenderingContext2D,
  type: PieceType, cx: number, cy: number, scale: number, colorblind: boolean,
): void {
  const cells = PIECE_SHAPES[type][0]!;
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const width = (Math.max(...xs) - Math.min(...xs) + 1) * scale;
  const height = (Math.max(...ys) - Math.min(...ys) + 1) * scale;
  const offsetX = cx - width / 2 - Math.min(...xs) * scale;
  const offsetY = cy - height / 2 - Math.min(...ys) * scale;

  for (const cell of cells) {
    const x = offsetX + cell.x * scale;
    const y = offsetY + cell.y * scale;
    glassTile(ctx, x, y, scale, PIECE_COLORS[type], 1);
    if (colorblind) {
      ctx.save();
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(15,28,63,0.9)';
      ctx.fillText(PIECE_GLYPHS[type], x + 3, y + 10);
      ctx.restore();
    }
  }
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, theme: RenderTheme): void {
  ctx.fillStyle = theme.surface;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = withAlpha(theme.accent, 0.22);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, theme: RenderTheme): void {
  ctx.save();
  ctx.font = '500 11px system-ui, sans-serif';
  ctx.fillStyle = theme.textMuted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function value(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, theme: RenderTheme, size = 22): void {
  ctx.save();
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.fillStyle = theme.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function renderKostkopad(
  ctx: CanvasRenderingContext2D,
  game: KostkopadGame,
  theme: RenderTheme,
  particles: ParticleSystem | null,
  alpha: number,
): void {
  const { state } = game;

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  // --- Herní pole ---
  ctx.fillStyle = shade(theme.background, -0.25);
  roundRect(ctx, BOARD_X - 6, BOARD_Y - 6, BOARD_W + 12, BOARD_H + 12, 10);
  ctx.fill();
  ctx.strokeStyle = withAlpha(theme.accent, 0.3);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Jemná mřížka — dost na orientaci, ne dost na to, aby rušila.
  if (!theme.lowQuality) {
    ctx.save();
    ctx.strokeStyle = withAlpha(theme.text, 0.05);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(BOARD_X + x * CELL, BOARD_Y);
      ctx.lineTo(BOARD_X + x * CELL, BOARD_Y + BOARD_H);
    }
    for (let y = 1; y < VISIBLE_ROWS; y++) {
      ctx.moveTo(BOARD_X, BOARD_Y + y * CELL);
      ctx.lineTo(BOARD_X + BOARD_W, BOARD_Y + y * CELL);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Položené kostky. Skryté řádky nad polem se nekreslí.
  for (let y = HIDDEN_ROWS; y < state.board.length; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = state.board[y]![x];
      if (!cell) continue;
      drawCell(ctx, BOARD_X + x * CELL, BOARD_Y + (y - HIDDEN_ROWS) * CELL, cell, 1, theme.colorblind);
    }
  }

  // Duch — kam tvar dopadne.
  if (state.active) {
    const ghostY = game.ghostY();
    const shape = PIECE_SHAPES[state.active.type][state.active.rotation]!;
    ctx.save();
    ctx.strokeStyle = withAlpha(PIECE_COLORS[state.active.type], 0.55);
    ctx.lineWidth = 2;
    for (const cell of shape) {
      const bx = state.active.x + cell.x;
      const by = ghostY + cell.y - HIDDEN_ROWS;
      if (by < 0) continue;
      roundRect(ctx, BOARD_X + bx * CELL + 3, BOARD_Y + by * CELL + 3, CELL - 6, CELL - 6, 5);
      ctx.stroke();
    }
    ctx.restore();

    // Aktivní tvar — interpolace mezi kroky logiky drží pád plynulý.
    const smooth = state.gravityAccum / 65536;
    for (const cell of shape) {
      const bx = state.active.x + cell.x;
      const by = state.active.y + cell.y - HIDDEN_ROWS;
      if (by < -1) continue;
      drawCell(
        ctx,
        BOARD_X + bx * CELL,
        BOARD_Y + (by + smooth * alpha * 0) * CELL,
        state.active.type, 1, theme.colorblind,
      );
    }
  }

  particles?.render(ctx);

  // --- Levý panel: držení a statistiky ---
  panel(ctx, 20, BOARD_Y, 145, 110, theme);
  label(ctx, 'DRŽENÍ', 34, BOARD_Y + 12, theme);
  if (state.hold) drawPreviewPiece(ctx, state.hold, 92, BOARD_Y + 66, 20, theme.colorblind);

  panel(ctx, 20, BOARD_Y + 126, 145, 200, theme);
  label(ctx, 'SKÓRE', 34, BOARD_Y + 138, theme);
  value(ctx, state.score.toLocaleString('cs-CZ'), 34, BOARD_Y + 154, theme, 24);
  label(ctx, 'ŘADY', 34, BOARD_Y + 196, theme);
  value(ctx, String(state.lines), 34, BOARD_Y + 212, theme);
  label(ctx, 'ÚROVEŇ', 34, BOARD_Y + 252, theme);
  value(ctx, String(state.level), 34, BOARD_Y + 268, theme);

  // --- Pravý panel: fronta ---
  panel(ctx, BOARD_X + BOARD_W + 20, BOARD_Y, 145, 300, theme);
  label(ctx, 'DALŠÍ', BOARD_X + BOARD_W + 34, BOARD_Y + 12, theme);
  state.preview.slice(0, 5).forEach((type, i) => {
    drawPreviewPiece(ctx, type, BOARD_X + BOARD_W + 92, BOARD_Y + 58 + i * 50, 17, theme.colorblind);
  });

  // --- Ukazatel příchozího odpadu (online souboj) ---
  if (state.pendingGarbage > 0) {
    const height = Math.min(BOARD_H, state.pendingGarbage * CELL);
    ctx.fillStyle = '#FF5F6D';
    ctx.fillRect(BOARD_X - 16, BOARD_Y + BOARD_H - height, 7, height);
  }

  // --- Hlášky za povedené tahy ---
  if (state.lastClear && state.lastClear.kind !== 'none') {
    const messages: Record<string, string> = {
      quad: 'Čtyři řady!',
      'tspin-single': 'T-otočka',
      'tspin-double': 'T-otočka × 2',
      'tspin-triple': 'T-otočka × 3',
      tspin: 'T-otočka',
      mini: 'Mini otočka',
      'mini-single': 'Mini otočka',
      'mini-double': 'Mini otočka × 2',
    };
    const message = state.lastClear.perfectClear
      ? 'Dokonalé vyčištění!'
      : messages[state.lastClear.kind];
    if (message) {
      centerText(ctx, message, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H + 26,
        '600 18px system-ui, sans-serif', theme.accent);
    }
  }

  if (state.combo > 0) {
    centerText(ctx, `Combo ${state.combo}`, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H + 50,
      '500 14px system-ui, sans-serif', theme.textMuted);
  }
}

/** Samohrající ukázka pro dlaždici a hero. */
export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;

  ctx.fillStyle = '#0F1C3F';
  ctx.fillRect(0, 0, width, height);

  const cols = 10;
  const cell = Math.floor(width / (cols + 2));
  const originX = (width - cols * cell) / 2;
  const rows = Math.floor(height / cell);

  ctx.save();
  ctx.strokeStyle = 'rgba(238,242,255,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= cols; x++) {
    ctx.beginPath();
    ctx.moveTo(originX + x * cell, 0);
    ctx.lineTo(originX + x * cell, height);
    ctx.stroke();
  }
  ctx.restore();

  // Hromada dole roste a zase se maže — pohyb bez skutečné simulace.
  const types: PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  const stackHeight = 3 + Math.floor((Math.sin(t * 0.4) + 1) * 2);
  for (let row = 0; row < stackHeight; row++) {
    for (let col = 0; col < cols; col++) {
      // Deterministická „náhoda" z pozice — stejný obrázek při každém načtení.
      const noise = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
      if (noise - Math.floor(noise) < 0.28) continue;
      const type = types[(col + row * 3) % types.length]!;
      glassTile(ctx, originX + col * cell, height - (row + 1) * cell, cell, PIECE_COLORS[type], 1);
    }
  }

  // Padající tvar.
  const fallingType = types[Math.floor(t / 2) % types.length]!;
  const fallProgress = (t % 2) / 2;
  const fallY = fallProgress * (height - stackHeight * cell - cell * 2);
  const fallX = originX + (2 + (Math.floor(t / 2) % 5)) * cell;
  for (const c of PIECE_SHAPES[fallingType][0]!) {
    glassTile(ctx, fallX + c.x * cell, fallY + c.y * cell, cell, PIECE_COLORS[fallingType], 1);
  }
}
