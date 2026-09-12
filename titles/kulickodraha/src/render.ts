/**
 * Vykreslení Kuličkodráhy.
 *
 * Pseudo-3D projekce (perspektivní dělení + mírné prohnutí dráhy do dálky)
 * vychází z veřejně publikovaného dema „Skydreams" (Frank Force, JS1024
 * 2026) — viz THIRD_PARTY.md, D-019. Barvy jdou přes vlastní herní paletu
 * projektu, ne přes originálovy natvrdo zapsané odstíny.
 */

import { herniPaleta, withAlpha } from '@vevit-games/engine';
import { TRACK_COLS, CAMERA_LOOKAHEAD, type KulickodrahaGame } from '@vevit-games/rules/kulickodraha';

export const VIEW_WIDTH = 640;
export const VIEW_HEIGHT = 400;

const FOCAL = 0.7;

/** Barevné pásmo dráhy podle vzdálených úseků — mění se každých 128 řádků. */
const TRACK_BANDS = [herniPaleta.tyrkys, herniPaleta.indigo, herniPaleta.fialova, herniPaleta.zelena];

/** Zesvětlí (`factor` > 0) nebo ztmaví (`factor` < 0) hex barvu. */
function shade(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (v: number): number => {
    const out = factor >= 0 ? v + (255 - v) * factor : v * (1 + factor);
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  const to = (v: number): string => mix(v).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Perspektivní projekce bodu dráhy do obrazovky. `dz` je vzdálenost před kamerou. */
function project(
  px: number, py: number, dz: number,
  playerX: number, camZ: number, width: number, height: number,
): [x: number, y: number, scale: number] {
  const scale = (height * FOCAL) / dz;
  const x = width / 2 + (px - playerX + ((dz - CAMERA_LOOKAHEAD) ** 2) / 50 * Math.cos((camZ + dz) / 49)) * scale;
  const y = height / 2 - (py - 2 + (dz * dz) / 50) * scale;
  return [x, y, scale];
}

export interface KulickodrahaTheme {
  accent: string;
  background: string;
  text: string;
  textMuted: string;
}

function drawSky(ctx: CanvasRenderingContext2D, width: number, height: number, camZ: number, theme: KulickodrahaTheme): void {
  const bands = 60;
  for (let i = bands; i > 0; i--) {
    const t = i / bands;
    const hueShift = (Math.sin((camZ + i) / 140) + 1) / 2;
    const base = hueShift > 0.5 ? herniPaleta.tyrkys : herniPaleta.indigo;
    ctx.fillStyle = shade(base, 0.55 - t * 0.5);
    ctx.fillRect(0, height * (1 - t), width, height / bands + 1);
  }
  // Hvězdy — deterministické podle indexu, ne náhodné, aby neblikaly mezi snímky.
  ctx.fillStyle = withAlpha(theme.text, 0.7);
  for (let i = 0; i < 80; i++) {
    const sx = (i * 137 + camZ * 4) % width;
    const sy = (i * 61) % (height * 0.5);
    const size = (i % 4) + 1;
    ctx.fillRect(sx, sy, size, size);
  }
}

function drawTrack(ctx: CanvasRenderingContext2D, rows: boolean[][], camZ: number, playerX: number, width: number, height: number): void {
  const nearRow = Math.floor(camZ);
  const farRow = Math.min(rows.length - 1, nearRow + 40);

  for (let r = farRow; r > nearRow; r--) {
    const row = rows[r];
    if (!row) continue;
    const band = TRACK_BANDS[(r >> 7) % TRACK_BANDS.length]!;
    const dzFar = r - camZ;
    if (dzFar <= 0.1) continue;
    const dzNear = dzFar + 1;

    for (let j = 0; j < TRACK_COLS; j++) {
      if (!row[j]) continue;

      const [ax, ay] = project(j - 3.5, 0, dzFar, playerX, camZ, width, height);
      const [bx] = project(j - 2.5, 0, dzFar, playerX, camZ, width, height);
      const [ex, ey] = project(j - 3.5, 0, dzNear, playerX, camZ, width, height);
      const [fx] = project(j - 2.5, 0, dzNear, playerX, camZ, width, height);

      const wallHeight = ((40 - r + camZ) / 30) * height;

      // Boční stěna dlaždice — tmavší, dává dojem hloubky.
      ctx.fillStyle = shade(band, -0.55);
      ctx.fillRect(ex, ey, fx - ex, wallHeight);

      // Vršek dlaždice — jasnější, střídá odstín podle sudosti pole.
      ctx.fillStyle = shade(band, (r + j) % 2 === 0 ? 0.15 : -0.1);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, ay);
      ctx.lineTo(fx, ey);
      ctx.lineTo(ex, ey);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export interface DrawOptions {
  bestScore?: number | null;
}

export function renderKulickodraha(
  ctx: CanvasRenderingContext2D,
  game: KulickodrahaGame,
  theme: KulickodrahaTheme,
  options: DrawOptions = {},
): void {
  const width = VIEW_WIDTH;
  const height = VIEW_HEIGHT;
  const { x: playerX, y: playerY, z: camZ, rows, score, over } = game.state;

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);
  drawSky(ctx, width, height, camZ, theme);
  drawTrack(ctx, rows, camZ, playerX, width, height);

  const ballDz = CAMERA_LOOKAHEAD;
  const [ballX, ballY, ballScale] = project(playerX, playerY, ballDz, playerX, camZ, width, height);
  const radius = Math.max(3, ballScale * 0.55);

  if (playerY <= 0.05) {
    const [shadowX, shadowY] = project(playerX, 0, ballDz, playerX, camZ, width, height);
    ctx.fillStyle = withAlpha('#000000', 0.4);
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, radius * 0.9, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(ballX, ballY - radius, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '600 18px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = theme.text;
  ctx.fillText(String(score).padStart(6, '0'), width - 14, 14);
  if (options.bestScore != null && options.bestScore > 0) {
    ctx.fillStyle = withAlpha(theme.text, 0.5);
    ctx.font = '500 14px ui-monospace, monospace';
    ctx.fillText(`HI ${options.bestScore}`, width - 14, 36);
  }

  if (over) {
    ctx.textAlign = 'center';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillStyle = theme.text;
    ctx.fillText('Pád z dráhy', width / 2, height / 2 - 16);
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillStyle = withAlpha(theme.text, 0.8);
    ctx.fillText(`Skóre ${score}`, width / 2, height / 2 + 14);
  }
}

/** Deterministický vzor dlaždic pro ukázku — bez závislosti na herní logice. */
function attractFilled(rowIndex: number, j: number): boolean {
  return ((rowIndex * 7 + j * 13) % 11) !== 0;
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  const camZ = t * 6;
  const playerX = TRACK_COLS / 2 + Math.sin(t * 0.6) * 1.5;
  const theme: KulickodrahaTheme = {
    accent: herniPaleta.zluta, background: '#08090C', text: '#FFFFFF', textMuted: '#A1A1AA',
  };

  c.fillStyle = theme.background;
  c.fillRect(0, 0, width, height);
  drawSky(c, width, height, camZ, theme);

  const rows: boolean[][] = [];
  for (let r = 0; r <= Math.floor(camZ) + 41; r++) {
    rows[r] = Array.from({ length: TRACK_COLS }, (_, j) => attractFilled(r, j));
  }
  drawTrack(c, rows, camZ, playerX, width, height);

  const bounce = Math.abs(Math.sin(t * 2)) * 0.8;
  const [ballX, ballY, ballScale] = project(playerX, bounce, CAMERA_LOOKAHEAD, playerX, camZ, width, height);
  c.fillStyle = theme.accent;
  c.beginPath();
  c.arc(ballX, ballY - Math.max(3, ballScale * 0.55), Math.max(3, ballScale * 0.55), 0, Math.PI * 2);
  c.fill();
}
