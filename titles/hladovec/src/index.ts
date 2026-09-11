/**
 * Hladovec.
 *
 * Hráč je zelený slizoun s očima, Prachoši jsou chlupaté kuličky prachu —
 * žádná žlutá koule s ústy a žádná jména z originálu (zadání sekce 2).
 */

import {
  createLoop, createSurface, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createHladovec, MAZE_W, MAZE_H, type Dir, type ChaserKind, type Chaser,
} from '@vevit-games/rules/hladovec';
import { manifest } from './manifest.js';

const CELL = 24;
const HEADER = 48;
const VIEW_W = MAZE_W * CELL;
const VIEW_H = MAZE_H * CELL + HEADER;

const WALL_COLOR = '#3A56B8';
const PLAYER_COLOR = '#2FD27A';

/** Každý Prachoš má vlastní barvu; povahu navíc prozradí tvar chomáče. */
const CHASER_COLORS: Record<ChaserKind, string> = {
  lovec: '#FF5F6D',
  nadbihac: '#FFB224',
  nahoda: '#C77DFF',
  plachy: '#4FD1E8',
};

const FRIGHTENED_COLOR = '#8FA6FF';

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
};

export const touchButtons = [
  { action: 'left', label: '◀', x: 10, y: 93, size: 54 },
  { action: 'up', label: '▲', x: 26, y: 86, size: 54 },
  { action: 'down', label: '▼', x: 26, y: 97, size: 54 },
  { action: 'right', label: '▶', x: 42, y: 93, size: 54 },
];

export const controlHints = [
  { action: 'left', label: 'Pohyb bludištěm', keys: '← ↑ → ↓' },
];

/** Chlupatý chomáč prachu: kruh s nepravidelnými chloupky a očima. */
function drawChaser(
  ctx: CanvasRenderingContext2D,
  chaser: Chaser, x: number, y: number, radius: number, frightened: boolean, phase: number,
): void {
  if (chaser.mode === 'navrat') {
    // Sněžený Prachoš je jen pár očí, které spěchají domů.
    ctx.fillStyle = '#EEF2FF';
    for (const dx of [-0.3, 0.3]) {
      ctx.beginPath();
      ctx.arc(x + dx * radius, y, radius * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  ctx.fillStyle = frightened ? FRIGHTENED_COLOR : CHASER_COLORS[chaser.kind];
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.78, 0, Math.PI * 2);
  ctx.fill();

  // Chloupky po obvodu — deterministické podle indexu, ne náhodné.
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + phase * 0.06;
    const length = radius * (0.86 + ((i * 7) % 5) * 0.05);
    ctx.moveTo(x + Math.cos(angle) * radius * 0.7, y + Math.sin(angle) * radius * 0.7);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
  }
  ctx.strokeStyle = frightened ? FRIGHTENED_COLOR : CHASER_COLORS[chaser.kind];
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = frightened ? '#0F1C3F' : '#EEF2FF';
  for (const dx of [-0.28, 0.28]) {
    ctx.beginPath();
    ctx.arc(x + dx * radius, y - radius * 0.1, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Zelený slizoun s očima — mrká podle fáze. */
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number, direction: Dir, phase: number,
): void {
  ctx.fillStyle = PLAYER_COLOR;
  ctx.beginPath();
  // Spodek je plochý jako kapka slizu.
  ctx.arc(x, y - radius * 0.08, radius * 0.82, Math.PI, 0);
  const wobble = Math.sin(phase * 0.25) * radius * 0.08;
  ctx.bezierCurveTo(
    x + radius * 0.82, y + radius * 0.7 + wobble,
    x - radius * 0.82, y + radius * 0.7 - wobble,
    x - radius * 0.82, y - radius * 0.08,
  );
  ctx.fill();

  const look = { up: [0, -0.2], down: [0, 0.2], left: [-0.2, 0], right: [0.2, 0] }[direction]!;
  ctx.fillStyle = '#0F1C3F';
  for (const dx of [-0.28, 0.28]) {
    ctx.beginPath();
    ctx.arc(
      x + dx * radius + look[0]! * radius,
      y - radius * 0.2 + look[1]! * radius,
      radius * 0.15, 0, Math.PI * 2,
    );
    ctx.fill();
  }
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = '#0F1C3F';
  c.fillRect(0, 0, width, height);

  const cell = Math.min(width / 11, height / 7);
  const originX = (width - 11 * cell) / 2;
  const originY = (height - 7 * cell) / 2;

  // Jednoduchá chodba s tečkami, po které slizoun ujíždí Prachošovi.
  c.strokeStyle = WALL_COLOR;
  c.lineWidth = 3;
  c.strokeRect(originX + cell * 0.5, originY + cell * 1.5, cell * 10, cell * 4);

  const progress = (t * 1.6) % 11;
  for (let i = 1; i < 10; i++) {
    if (i < progress) continue;
    c.fillStyle = '#E9D8A6';
    c.beginPath();
    c.arc(originX + (i + 0.5) * cell, originY + 3.5 * cell, cell * 0.11, 0, Math.PI * 2);
    c.fill();
  }

  const px = originX + (progress + 0.5) * cell;
  drawPlayer(c, px, originY + 3.5 * cell, cell * 0.42, 'right', t * 10);

  const chaser = {
    kind: 'lovec' as ChaserKind, mode: 'pronasledovani' as const,
  } as Chaser;
  drawChaser(c, chaser, px - cell * 2.2, originY + 3.5 * cell, cell * 0.42, false, t * 10);
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  let game = createHladovec(ctx.seed);
  let finished = false;
  let lastScore = 0;

  const toScreen = (x: number, y: number): { sx: number; sy: number } => ({
    sx: (x + 0.5) * CELL,
    sy: HEADER + (y + 0.5) * CELL,
  });

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play(game.state.won ? 'win' : 'lose');
    const durationMs = Math.round((game.state.tick * 1000) / 60);
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score: game.state.score, durationMs,
      stats: { uroven: game.state.level + 1 },
    });
    ctx.emit({
      type: game.state.won ? 'win' : 'gameover',
      score: game.state.score, durationMs, stats: { uroven: game.state.level + 1 },
    });
  };

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    c.font = '500 14px system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText(`Úroveň ${game.state.level + 1}`, 12, HEADER / 2);
    c.textAlign = 'center';
    c.fillStyle = ctx.theme.text;
    c.font = '600 19px system-ui, sans-serif';
    c.fillText(String(game.state.score), VIEW_W / 2, HEADER / 2);
    c.textAlign = 'right';
    c.fillStyle = PLAYER_COLOR;
    c.fillText('●'.repeat(Math.max(0, game.state.lives)), VIEW_W - 12, HEADER / 2);

    // Stěny jako neonové obrysy: kreslíme jen hrany mezi zdí a chodbou.
    c.strokeStyle = WALL_COLOR;
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    c.beginPath();
    for (let y = 0; y < MAZE_H; y++) {
      for (let x = 0; x < MAZE_W; x++) {
        if (game.passable(x, y)) continue;
        const left = x * CELL;
        const top = HEADER + y * CELL;
        // Hranu kreslíme, jen když je za ní chodba.
        if (game.passable(x, y - 1)) { c.moveTo(left + 2, top + 1); c.lineTo(left + CELL - 2, top + 1); }
        if (game.passable(x, y + 1)) { c.moveTo(left + 2, top + CELL - 1); c.lineTo(left + CELL - 2, top + CELL - 1); }
        if (game.passable(x - 1, y)) { c.moveTo(left + 1, top + 2); c.lineTo(left + 1, top + CELL - 2); }
        if (game.passable(x + 1, y)) { c.moveTo(left + CELL - 1, top + 2); c.lineTo(left + CELL - 1, top + CELL - 2); }
      }
    }
    c.stroke();

    // Tečky
    for (let y = 0; y < MAZE_H; y++) {
      for (let x = 0; x < MAZE_W; x++) {
        const { sx, sy } = toScreen(x, y);
        if (game.state.dots[y]?.[x]) {
          c.fillStyle = '#E9D8A6';
          c.beginPath();
          c.arc(sx, sy, 2.6, 0, Math.PI * 2);
          c.fill();
        } else if (game.state.powerDots[y]?.[x]) {
          // Velká tečka pulzuje, aby byla na první pohled jiná.
          const pulse = ctx.theme.reducedMotion ? 1 : 1 + Math.sin(game.state.tick * 0.12) * 0.18;
          c.fillStyle = '#FFB224';
          c.beginPath();
          c.arc(sx, sy, 6 * pulse, 0, Math.PI * 2);
          c.fill();
        }
      }
    }

    if (game.state.fruit) {
      const { sx, sy } = toScreen(game.state.fruit.x, game.state.fruit.y);
      c.fillStyle = '#FF6B81';
      c.beginPath();
      c.arc(sx, sy, 8, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#5FD9A0';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(sx, sy - 8);
      c.lineTo(sx + 4, sy - 13);
      c.stroke();
    }

    const phase = game.state.tick;
    for (const chaser of game.state.chasers) {
      const { sx, sy } = toScreen(chaser.x, chaser.y);
      const frightened = chaser.mode === 'vystraseny';
      // Poslední sekundy vystrašení blikají, aby hráč věděl, že končí.
      const blinking = frightened && chaser.frightenedTicks < 120
        && Math.floor(chaser.frightenedTicks / 12) % 2 === 0;
      drawChaser(c, chaser, sx, sy, CELL * 0.46, frightened && !blinking, phase);
    }

    const player = toScreen(game.state.playerX, game.state.playerY);
    drawPlayer(c, player.sx, player.sy, CELL * 0.46, game.state.direction, phase);

    if (game.state.over || game.state.won) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.84);
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      centerText(c, game.state.won ? 'Bludiště vysbíráno' : 'Prachoši tě dostali',
        VIEW_W / 2, VIEW_H / 2, '600 26px system-ui, sans-serif',
        game.state.won ? PLAYER_COLOR : '#FF5F6D');
    }
  };

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();

        let dir: Dir | null = null;
        if (input.pressed('left')) dir = 'left';
        else if (input.pressed('right')) dir = 'right';
        else if (input.pressed('up')) dir = 'up';
        else if (input.pressed('down')) dir = 'down';

        const before = game.state.score;
        game.step(dir);
        if (game.state.score !== before) {
          if (game.state.score - before >= 200) ctx.audio.play('levelUp');
          else if (game.state.score - before >= 50) ctx.audio.play('pickup');
          else ctx.audio.play('tick');
          lastScore = game.state.score;
          ctx.emit({ type: 'score', value: lastScore });
        }
        if (game.state.over || game.state.won) finish();
      },
      render() {
        surface.begin();
        draw();
      },
    },
    { onAutoPause: () => ctx.emit({ type: 'paused' }) },
  );

  // Švih prstem je na mobilu rychlejší než kříž.
  let swipeStart: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent): void => { swipeStart = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: PointerEvent): void => {
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.hypot(dx, dy) < 24) return;
    const dir: Dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
    input.setVirtual(dir, true);
    // Jedno klepnutí = jedna předvolba směru.
    window.setTimeout(() => input.setVirtual(dir, false), 40);
  };
  surface.canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);

  loop.start();
  ctx.emit({ type: 'ready' });
  ctx.emit({ type: 'started' });

  return {
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    restart() {
      game = createHladovec(ctx.seed);
      finished = false;
      lastScore = 0;
      loop.resume();
      ctx.emit({ type: 'started' });
    },
    destroy() {
      loop.stop();
      surface.canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, touchButtons, controlHints };
