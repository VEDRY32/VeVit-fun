/**
 * Piškvorky — čtverečkovaný papír, křížky a kolečka „kreslené" propiskou.
 *
 * Plocha je neomezená, takže se pohled posouvá za hrou. Ručně kreslený
 * dojem dělá jemné, ale deterministické rozkmitání tahů: stejná pozice
 * vypadá při každém vykreslení stejně.
 */

import {
  herniPaleta,
  createLoop, createSurface, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import { createPiskvorky, type Difficulty, type Mark } from '@vevit-games/rules/piskvorky';
import { manifest } from './manifest.js';

const VIEW_W = 640;
const VIEW_H = 620;
const HEADER = 56;
const CELL = 34;

/* Papír a inkoust: hra se hraje na sešitovém papíře, takže její plocha je
   světlá a barvy z herní palety (laděné na tmavé pozadí) by na ní zmizely.
   Tyhle čtyři odstíny jsou proto lokální — jinam v portálu nepatří. */
const PAPER = '#F4F1E6';
const GRID = herniPaleta.kamen;
const INK_X = '#2B4C9B';
const INK_O = '#C0392F';

/** Kroků, po které AI „přemýšlí" — bez pauzy by tah působil strojově. */
const AI_THINK_TICKS = 26;

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  a: ['Space', 'Enter'],
  b: ['KeyZ'],
};

export const controlHints = [
  { action: 'pointer', label: 'Položit značku', keys: 'klik / tap' },
  { action: 'left', label: 'Kurzor', keys: '← ↑ → ↓' },
  { action: 'a', label: 'Položit', keys: 'mezerník' },
  { action: 'b', label: 'Krok zpět', keys: 'Z' },
];

/** Malá, ale stálá odchylka podle souřadnic — dojem ruční kresby. */
function jitter(x: number, y: number, salt: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + salt * 3.77) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * 3.2;
}

function drawMark(
  ctx: CanvasRenderingContext2D,
  mark: Mark, cx: number, cy: number, size: number, gx: number, gy: number, alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = mark === 'x' ? INK_X : INK_O;

  const r = size * 0.34;
  if (mark === 'x') {
    ctx.beginPath();
    ctx.moveTo(cx - r + jitter(gx, gy, 1), cy - r + jitter(gx, gy, 2));
    ctx.lineTo(cx + r + jitter(gx, gy, 3), cy + r + jitter(gx, gy, 4));
    ctx.moveTo(cx + r + jitter(gx, gy, 5), cy - r + jitter(gx, gy, 6));
    ctx.lineTo(cx - r + jitter(gx, gy, 7), cy + r + jitter(gx, gy, 8));
    ctx.stroke();
  } else {
    // Kolečko nakreslené jedním tahem s mírně proměnlivým poloměrem.
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const wobble = r + jitter(gx + i, gy, 9) * 0.35;
      const px = cx + Math.cos(angle) * wobble;
      const py = cy + Math.sin(angle) * wobble;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;

  c.fillStyle = PAPER;
  c.fillRect(0, 0, width, height);

  const cell = Math.min(width / 9, height / 6);
  c.strokeStyle = GRID;
  c.lineWidth = 1;
  c.beginPath();
  for (let x = 0; x <= width; x += cell) {
    c.moveTo(x, 0);
    c.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += cell) {
    c.moveTo(0, y);
    c.lineTo(width, y);
  }
  c.stroke();

  // Partie se postupně zapisuje a pak začíná znovu.
  const sequence: [number, number, Mark][] = [
    [2, 2, 'x'], [3, 1, 'o'], [3, 2, 'x'], [4, 1, 'o'],
    [4, 2, 'x'], [5, 1, 'o'], [5, 2, 'x'], [2, 1, 'o'], [6, 2, 'x'],
  ];
  const shown = Math.floor((t * 1.4) % (sequence.length + 3));

  for (let i = 0; i < Math.min(shown, sequence.length); i++) {
    const [gx, gy, mark] = sequence[i]!;
    drawMark(c, mark, (gx + 0.5) * cell, (gy + 0.5) * cell, cell, gx, gy);
  }
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: PAPER,
  });
  const { input } = ctx;

  const versusComputer = ctx.mode !== 'dva-hraci';
  const difficulty = (versusComputer ? ctx.mode : 'stredni') as Difficulty;

  let game = createPiskvorky(ctx.seed);
  let finished = false;
  let aiTimer = 0;
  // Střed pohledu v herních souřadnicích.
  let cameraX = 0;
  let cameraY = 0;
  let cursorX = 0;
  let cursorY = 0;
  let showCursor = false;

  const boardTop = HEADER;
  const boardH = VIEW_H - HEADER;

  const toScreen = (gx: number, gy: number): { x: number; y: number } => ({
    x: VIEW_W / 2 + (gx - cameraX) * CELL,
    y: boardTop + boardH / 2 + (gy - cameraY) * CELL,
  });

  const toGrid = (sx: number, sy: number): { x: number; y: number } => ({
    x: Math.round((sx - VIEW_W / 2) / CELL + cameraX),
    y: Math.round((sy - boardTop - boardH / 2) / CELL + cameraY),
  });

  const finish = (): void => {
    if (finished) return;
    finished = true;
    const playerWon = game.state.winner === 'x';
    ctx.audio.play(game.state.draw ? 'tick' : playerWon ? 'win' : 'lose');
    ctx.emit({
      type: playerWon || game.state.draw ? 'win' : 'gameover',
      score: game.state.moves.length,
      durationMs: 0,
      stats: { tahy: game.state.moves.length },
    });
  };

  const place = (gx: number, gy: number): void => {
    if (aiTimer > 0 || game.state.winner || game.state.draw) return;
    if (!game.place(gx, gy)) {
      ctx.audio.play('error');
      return;
    }
    ctx.audio.play('click');

    // Pohled jde za posledním tahem, ale jen když se blíží k okraji.
    const screen = toScreen(gx, gy);
    const margin = CELL * 2.5;
    if (screen.x < margin) cameraX -= (margin - screen.x) / CELL;
    if (screen.x > VIEW_W - margin) cameraX += (screen.x - (VIEW_W - margin)) / CELL;
    if (screen.y < boardTop + margin) cameraY -= (boardTop + margin - screen.y) / CELL;
    if (screen.y > VIEW_H - margin) cameraY += (screen.y - (VIEW_H - margin)) / CELL;

    if (game.state.winner || game.state.draw) finish();
    else if (versusComputer && game.state.current === 'o') aiTimer = AI_THINK_TICKS;
  };

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = PAPER;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    // Hlavička na papíře, oddělená linkou.
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '600 19px system-ui, sans-serif';
    if (game.state.winner) {
      c.fillStyle = game.state.winner === 'x' ? INK_X : INK_O;
      c.fillText(
        versusComputer
          ? (game.state.winner === 'x' ? 'Vyhrál jsi' : 'Vyhrál počítač')
          : `Vyhrál ${game.state.winner === 'x' ? 'křížek' : 'kolečko'}`,
        VIEW_W / 2, HEADER / 2,
      );
    } else {
      c.fillStyle = game.state.current === 'x' ? INK_X : INK_O;
      c.fillText(
        aiTimer > 0
          ? 'Počítač přemýšlí…'
          : game.state.current === 'x' ? 'Křížek je na tahu' : 'Kolečko je na tahu',
        VIEW_W / 2, HEADER / 2,
      );
    }

    c.strokeStyle = GRID;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, HEADER);
    c.lineTo(VIEW_W, HEADER);
    c.stroke();

    // Mřížka: kreslíme jen to, co je vidět.
    c.save();
    c.beginPath();
    c.rect(0, boardTop, VIEW_W, boardH);
    c.clip();

    c.strokeStyle = GRID;
    c.beginPath();
    const originX = toScreen(0, 0).x % CELL;
    const originY = toScreen(0, 0).y % CELL;
    for (let x = originX - CELL; x < VIEW_W + CELL; x += CELL) {
      c.moveTo(Math.round(x) + 0.5, boardTop);
      c.lineTo(Math.round(x) + 0.5, VIEW_H);
    }
    for (let y = originY - CELL; y < VIEW_H + CELL; y += CELL) {
      c.moveTo(0, Math.round(y) + 0.5);
      c.lineTo(VIEW_W, Math.round(y) + 0.5);
    }
    c.stroke();

    for (const move of game.state.moves) {
      const { x, y } = toScreen(move.x, move.y);
      if (x < -CELL || x > VIEW_W + CELL || y < boardTop - CELL || y > VIEW_H + CELL) continue;
      drawMark(c, move.mark, x, y, CELL, move.x, move.y);
    }

    // Vítězná řada se podtrhne.
    if (game.state.winningLine.length >= 2) {
      const first = toScreen(game.state.winningLine[0]!.x, game.state.winningLine[0]!.y);
      const last = toScreen(
        game.state.winningLine[game.state.winningLine.length - 1]!.x,
        game.state.winningLine[game.state.winningLine.length - 1]!.y,
      );
      c.strokeStyle = withAlpha(game.state.winner === 'x' ? INK_X : INK_O, 0.75);
      c.lineWidth = 4;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(first.x, first.y);
      c.lineTo(last.x, last.y);
      c.stroke();
    }

    if (showCursor && !game.state.winner) {
      const { x, y } = toScreen(cursorX, cursorY);
      c.strokeStyle = withAlpha(INK_X, 0.45);
      c.lineWidth = 2;
      c.strokeRect(x - CELL / 2, y - CELL / 2, CELL, CELL);
    }

    // Poslední tah dostane tečku, ať je vidět, kam soupeř hrál.
    const last = game.state.moves[game.state.moves.length - 1];
    if (last) {
      const { x, y } = toScreen(last.x, last.y);
      c.fillStyle = last.mark === 'x' ? INK_X : INK_O;
      c.beginPath();
      c.arc(x + CELL * 0.34, y - CELL * 0.34, 3, 0, Math.PI * 2);
      c.fill();
    }

    c.restore();

    if (game.state.moves.length === 0) {
      centerText(c, 'Klikni kamkoliv a začni', VIEW_W / 2, boardTop + boardH / 2 + CELL * 2.5,
        '500 14px system-ui, sans-serif', withAlpha('#2B4C9B', 0.5));
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (versusComputer && game.state.current === 'o') return;
    const local = surface.toLogical(e.clientX, e.clientY);
    if (local.y < boardTop) return;
    const cell = toGrid(local.x, local.y);
    cursorX = cell.x;
    cursorY = cell.y;
    place(cell.x, cell.y);
  };
  surface.canvas.addEventListener('pointerup', onPointerUp);

  const loop = createLoop(
    {
      update() {
        input.sample();

        if (aiTimer > 0) {
          if (--aiTimer === 0) {
            const move = game.aiMove(difficulty);
            if (move) place(move.x, move.y);
          }
          return;
        }
        if (game.state.winner || game.state.draw) return;

        if (input.repeated('left')) { cursorX--; showCursor = true; }
        if (input.repeated('right')) { cursorX++; showCursor = true; }
        if (input.repeated('up')) { cursorY--; showCursor = true; }
        if (input.repeated('down')) { cursorY++; showCursor = true; }
        if (input.pressed('a')) place(cursorX, cursorY);
        if (input.pressed('b')) {
          game.undo();
          if (versusComputer) game.undo();
          finished = false;
          ctx.audio.play('tick');
        }

        // Pohled dojíždí za kurzorem, aby kurzor nikdy neutekl z obrazu.
        const screen = toScreen(cursorX, cursorY);
        const margin = CELL * 2;
        if (screen.x < margin) cameraX -= 0.35;
        if (screen.x > VIEW_W - margin) cameraX += 0.35;
        if (screen.y < boardTop + margin) cameraY -= 0.35;
        if (screen.y > VIEW_H - margin) cameraY += 0.35;
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
      game = createPiskvorky(ctx.seed);
      finished = false;
      aiTimer = 0;
      cameraX = 0;
      cameraY = 0;
      cursorX = 0;
      cursorY = 0;
      loop.resume();
      ctx.emit({ type: 'started' });
    },
    destroy() {
      loop.stop();
      surface.canvas.removeEventListener('pointerup', onPointerUp);
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, controlHints };
