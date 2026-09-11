/**
 * Vykreslení Běžce.
 *
 * Sdílí ho stránka hry i offline stránka portálu, proto je oddělené od
 * `mount` a nepotřebuje herní kontext — jen stav a barvy.
 */

import { withAlpha } from '@vevit-games/engine';
import { GROUND_Y, WORLD_W, WORLD_H, type BezecGame, type ObstacleKind } from '@vevit-games/rules/bezec';

export interface BezecPalette {
  sky: string;
  ground: string;
  fox: string;
  obstacle: string;
  text: string;
}

export const DAY: BezecPalette = {
  sky: '#0F1C3F', ground: '#A3B1D6', fox: '#FFB224', obstacle: '#5FD9A0', text: '#EEF2FF',
};
export const NIGHT: BezecPalette = {
  sky: '#050A1C', ground: '#4A5680', fox: '#FFD98A', obstacle: '#2E8F63', text: '#A3B1D6',
};

/** Lineární přechod dvou barev — plynulý cyklus dne a noci. */
function mix(a: string, b: string, t: number): string {
  const parse = (hex: string): number[] => {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const [ar, ag, ab] = parse(a) as [number, number, number];
  const [br, bg, bb] = parse(b) as [number, number, number];
  const to = (v: number): string => Math.round(v).toString(16).padStart(2, '0');
  return `#${to(ar + (br - ar) * t)}${to(ag + (bg - ag) * t)}${to(ab + (bb - ab) * t)}`;
}

export function paletteFor(night: number): BezecPalette {
  return {
    sky: mix(DAY.sky, NIGHT.sky, night),
    ground: mix(DAY.ground, NIGHT.ground, night),
    fox: mix(DAY.fox, NIGHT.fox, night),
    obstacle: mix(DAY.obstacle, NIGHT.obstacle, night),
    text: mix(DAY.text, NIGHT.text, night),
  };
}

/** Liška jako jednoduchá silueta — běží, skáče i se krčí. */
function drawFox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string, running: boolean, phase: number,
): void {
  ctx.fillStyle = color;
  const ducking = h < 30;

  // Tělo
  ctx.beginPath();
  ctx.ellipse(x + w * 0.45, y + h * 0.45, w * 0.42, h * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hlava s ušima
  const headX = x + w * 0.82;
  const headY = ducking ? y + h * 0.4 : y + h * 0.22;
  ctx.beginPath();
  ctx.arc(headX, headY, h * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(headX - h * 0.14, headY - h * 0.14);
  ctx.lineTo(headX - h * 0.06, headY - h * 0.34);
  ctx.lineTo(headX + h * 0.04, headY - h * 0.16);
  ctx.closePath();
  ctx.fill();

  // Ocas
  ctx.beginPath();
  ctx.moveTo(x + w * 0.06, y + h * 0.42);
  ctx.quadraticCurveTo(x - w * 0.3, y + h * 0.1, x - w * 0.06, y - h * 0.05);
  ctx.quadraticCurveTo(x + w * 0.06, y + h * 0.2, x + w * 0.12, y + h * 0.52);
  ctx.fill();

  // Nohy: při běhu se střídají, ve vzduchu jsou natažené.
  const swing = running ? Math.sin(phase * 0.5) * h * 0.16 : h * 0.1;
  ctx.lineWidth = Math.max(2, h * 0.1);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.32, y + h * 0.7);
  ctx.lineTo(x + w * 0.32 - swing, y + h);
  ctx.moveTo(x + w * 0.62, y + h * 0.7);
  ctx.lineTo(x + w * 0.62 + swing, y + h);
  ctx.stroke();

  ctx.fillStyle = '#0F1C3F';
  ctx.beginPath();
  ctx.arc(headX + h * 0.06, headY - h * 0.03, h * 0.045, 0, Math.PI * 2);
  ctx.fill();
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  kind: ObstacleKind, x: number, y: number, w: number, h: number, color: string,
): void {
  ctx.fillStyle = color;

  if (kind.startsWith('pták')) {
    // Pták: dvě křídla, jejichž sklon určuje fáze zakódovaná v pozici.
    const flap = Math.sin(x * 0.08) * h * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w * 0.5, y + h / 2 - flap);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w * 0.5, y + h / 2 + h * 0.3);
    ctx.closePath();
    ctx.fill();
    return;
  }

  // Keře: svislé výhonky různé výšky.
  const stems = kind === 'ker-trojity' ? 5 : kind === 'ker-velky' ? 3 : 2;
  const stemW = w / (stems * 1.6);
  for (let i = 0; i < stems; i++) {
    const sx = x + i * (w / stems) + stemW * 0.3;
    const sh = h * (i % 2 === 0 ? 1 : 0.68);
    ctx.fillRect(sx, y + (h - sh), stemW, sh);
    ctx.beginPath();
    ctx.arc(sx + stemW / 2, y + (h - sh), stemW * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface DrawOptions {
  showHint: boolean;
  bestScore?: number | null;
  /** Text nad plochou — offline stránka tudy hlásí stav připojení. */
  banner?: string;
}

export function drawBezec(
  ctx: CanvasRenderingContext2D,
  game: BezecGame,
  options: DrawOptions,
): void {
  const palette = paletteFor(game.state.night);

  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Hvězdy v noci — deterministické, aby neblikaly.
  if (game.state.night > 0.35) {
    ctx.fillStyle = withAlpha('#ffffff', (game.state.night - 0.35) * 0.9);
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 137) % WORLD_W);
      const sy = ((i * 61) % (GROUND_Y - 60)) + 12;
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  // Země: čára plus tečky, které ubíhají podle uražené vzdálenosti.
  ctx.strokeStyle = palette.ground;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 1);
  ctx.lineTo(WORLD_W, GROUND_Y + 1);
  ctx.stroke();

  const offset = (game.state.distance / 65536) % 40;
  ctx.fillStyle = withAlpha(palette.ground, 0.6);
  for (let x = -offset; x < WORLD_W; x += 40) {
    ctx.fillRect(x, GROUND_Y + 8, 14, 2);
    ctx.fillRect(x + 22, GROUND_Y + 15, 7, 2);
  }

  for (const rect of game.obstacleRects()) {
    drawObstacle(ctx, rect.kind, rect.x, rect.y, rect.w, rect.h, palette.obstacle);
  }

  const fox = game.foxRect();
  drawFox(ctx, fox.x, fox.y, fox.w, fox.h, palette.fox,
    game.state.onGround && game.state.started, game.state.tick);

  // Skóre vpravo nahoře, rekord vedle něj tlumeně.
  ctx.font = '600 16px ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.text;
  ctx.fillText(String(game.state.score).padStart(5, '0'), WORLD_W - 14, 14);
  if (options.bestScore != null && options.bestScore > 0) {
    ctx.fillStyle = withAlpha(palette.text, 0.5);
    ctx.fillText(`HI ${String(options.bestScore).padStart(5, '0')}`, WORLD_W - 90, 14);
  }

  if (options.banner) {
    ctx.textAlign = 'left';
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillStyle = withAlpha(palette.text, 0.75);
    ctx.fillText(options.banner, 14, 14);
  }

  if (options.showHint && !game.state.started) {
    ctx.textAlign = 'center';
    ctx.font = '500 15px system-ui, sans-serif';
    ctx.fillStyle = withAlpha(palette.text, 0.8);
    ctx.fillText('Skoč mezerníkem nebo tapem', WORLD_W / 2, GROUND_Y - 70);
  }

  if (game.state.over) {
    ctx.textAlign = 'center';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillStyle = palette.text;
    ctx.fillText('Konec běhu', WORLD_W / 2, GROUND_Y - 96);
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillText('Skok spustí nový', WORLD_W / 2, GROUND_Y - 68);
  }
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  const palette = paletteFor((Math.sin(t * 0.3) + 1) / 2);

  c.fillStyle = palette.sky;
  c.fillRect(0, 0, width, height);

  const scale = Math.min(width / WORLD_W, height / WORLD_H) * 1.6;
  c.save();
  c.translate(0, (height - WORLD_H * scale) / 2);
  c.scale(scale, scale);

  c.strokeStyle = palette.ground;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, GROUND_Y + 1);
  c.lineTo(WORLD_W, GROUND_Y + 1);
  c.stroke();

  const offset = (t * 150) % 40;
  c.fillStyle = withAlpha(palette.ground, 0.6);
  for (let x = -offset; x < WORLD_W; x += 40) c.fillRect(x, GROUND_Y + 8, 14, 2);

  // Keř ubíhá a liška ho přeskakuje v pravidelném rytmu.
  const cycle = (t * 1.4) % 2;
  const bushX = WORLD_W - ((t * 150) % (WORLD_W + 80));
  drawObstacle(c, 'ker-velky', bushX, GROUND_Y - 44, 28, 44, palette.obstacle);

  const jump = cycle < 1 ? Math.sin(cycle * Math.PI) * 60 : 0;
  drawFox(c, 70, GROUND_Y - 40 - jump, 38, 40, palette.fox, jump === 0, t * 60);

  c.restore();
}
