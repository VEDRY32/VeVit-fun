/**
 * Čtyři v řadě — animace pádu žetonu a AI, která přemýšlí mimo snímek.
 *
 * Minimax do hloubky 7 trvá i pár set milisekund. Kdyby běžel v kroku
 * logiky, hra by se viditelně zaseknula, takže se spouští až po dopadu
 * žetonu a jeho výsledek se zpracuje v dalším kroku.
 */

import {
  createLoop, createSurface, centerText, withAlpha, shade, easing, clamp01,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import { createCtyriVRade, CTYRI_COLS, CTYRI_ROWS, type Difficulty } from '@vevit-games/rules/ctyri-v-rade';
import { manifest } from './manifest.js';

const VIEW = 620;
const HEADER = 70;
const BOARD_PAD = 16;

const PLAYER_COLORS = ['#FFB224', '#FF5F6D'] as const;
/** Symbol navíc k barvě pro colorblind režim. */
const PLAYER_GLYPHS = ['●', '◆'] as const;

/** Kroků logiky, které AI „přemýšlí", aby tah nepůsobil bezmyšlenkovitě. */
const AI_THINK_TICKS = 24;

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  a: ['Space', 'ArrowDown', 'Enter'],
  b: ['KeyZ'],
};

export const controlHints = [
  { action: 'pointer', label: 'Vhodit žeton', keys: 'klik / tap' },
  { action: 'left', label: 'Výběr sloupce', keys: '← →' },
  { action: 'a', label: 'Vhodit', keys: 'mezerník' },
  { action: 'b', label: 'Krok zpět', keys: 'Z' },
];

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = '#0F1C3F';
  c.fillRect(0, 0, width, height);

  const cell = Math.min(width / (CTYRI_COLS + 0.5), height / (CTYRI_ROWS + 0.5));
  const boardW = cell * CTYRI_COLS;
  const boardH = cell * CTYRI_ROWS;
  const originX = (width - boardW) / 2;
  const originY = (height - boardH) / 2;

  c.fillStyle = '#1B2A55';
  c.fillRect(originX, originY, boardW, boardH);

  // Deska se plní a zase vyprazdňuje — deterministicky podle času.
  const filled = Math.floor((t * 2.5) % 26);
  for (let col = 0; col < CTYRI_COLS; col++) {
    for (let row = 0; row < CTYRI_ROWS; row++) {
      const order = col * 2 + row * 3;
      const x = originX + col * cell + cell / 2;
      const y = originY + (CTYRI_ROWS - 1 - row) * cell + cell / 2;
      c.beginPath();
      c.arc(x, y, cell * 0.38, 0, Math.PI * 2);
      c.fillStyle = order < filled
        ? PLAYER_COLORS[(col + row) % 2]!
        : '#0F1C3F';
      c.fill();
    }
  }
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW, logicalHeight: VIEW, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const versusComputer = ctx.mode !== 'dva-hraci';
  const difficulty = (versusComputer ? ctx.mode : 'stredni') as Difficulty;

  let game = createCtyriVRade(ctx.seed);
  let finished = false;
  let cursor = Math.floor(CTYRI_COLS / 2);
  let aiTimer = 0;
  /** Padající žeton: sloupec, cíl a postup animace. */
  let falling: { col: number; row: number; player: 1 | 2; progress: number } | null = null;

  const boardSize = VIEW - BOARD_PAD * 2;
  const cell = Math.min(boardSize / CTYRI_COLS, (VIEW - HEADER - BOARD_PAD * 2) / CTYRI_ROWS);
  const boardW = cell * CTYRI_COLS;
  const boardH = cell * CTYRI_ROWS;
  const originX = (VIEW - boardW) / 2;
  const originY = HEADER + (VIEW - HEADER - boardH) / 2;

  const cellCenter = (col: number, row: number): { x: number; y: number } => ({
    x: originX + col * cell + cell / 2,
    y: originY + (CTYRI_ROWS - 1 - row) * cell + cell / 2,
  });

  const finish = (): void => {
    if (finished) return;
    finished = true;
    const humanWon = game.state.winner === 1;
    ctx.audio.play(game.state.draw ? 'tick' : humanWon ? 'win' : 'lose');
    ctx.emit({
      type: humanWon || game.state.draw ? 'win' : 'gameover',
      score: game.state.winner === 1 ? 1 : 0,
      durationMs: 0,
      stats: { tahy: game.state.moves },
    });
  };

  const dropAt = (col: number): void => {
    if (falling || game.state.winner || game.state.draw) return;
    const player = game.state.current;
    const row = game.drop(col);
    if (row < 0) {
      ctx.audio.play('error');
      return;
    }
    falling = { col, row, player, progress: 0 };
    ctx.audio.play('move');
  };

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW, VIEW);

    // Hlavička: kdo je na tahu, nebo výsledek.
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (game.state.winner) {
      const index = game.state.winner - 1;
      c.font = '600 24px system-ui, sans-serif';
      c.fillStyle = PLAYER_COLORS[index]!;
      const label = versusComputer
        ? (game.state.winner === 1 ? 'Vyhrál jsi' : 'Vyhrál počítač')
        : `Vyhrál hráč ${game.state.winner}`;
      c.fillText(label, VIEW / 2, HEADER / 2);
    } else if (game.state.draw) {
      c.font = '600 24px system-ui, sans-serif';
      c.fillStyle = ctx.theme.textMuted;
      c.fillText('Remíza — deska je plná', VIEW / 2, HEADER / 2);
    } else {
      const index = game.state.current - 1;
      c.font = '600 20px system-ui, sans-serif';
      c.fillStyle = PLAYER_COLORS[index]!;
      const label = versusComputer
        ? (game.state.current === 1 ? 'Jsi na tahu' : 'Počítač přemýšlí…')
        : `Na tahu hráč ${game.state.current}`;
      c.fillText(label, VIEW / 2, HEADER / 2);
    }

    // Ukazatel vybraného sloupce.
    const myTurn = !versusComputer || game.state.current === 1;
    if (myTurn && !game.state.winner && !game.state.draw && !falling) {
      const { x } = cellCenter(cursor, 0);
      c.fillStyle = withAlpha(PLAYER_COLORS[game.state.current - 1]!, 0.75);
      c.beginPath();
      c.moveTo(x - 12, originY - 22);
      c.lineTo(x + 12, originY - 22);
      c.lineTo(x, originY - 6);
      c.closePath();
      c.fill();
    }

    // Deska: modrý blok s vyříznutými kruhy.
    c.fillStyle = '#1B2A55';
    c.fillRect(originX, originY, boardW, boardH);

    for (let col = 0; col < CTYRI_COLS; col++) {
      for (let row = 0; row < CTYRI_ROWS; row++) {
        const { x, y } = cellCenter(col, row);
        const value = game.state.board[col]![row]!;
        const isFalling = falling?.col === col && falling.row === row;

        c.beginPath();
        c.arc(x, y, cell * 0.38, 0, Math.PI * 2);
        if (value === 0 || isFalling) {
          c.fillStyle = ctx.theme.background;
          c.fill();
          continue;
        }

        const index = value - 1;
        const winning = game.state.winningCells.some((w) => w.col === col && w.row === row);
        c.fillStyle = winning ? shade(PLAYER_COLORS[index]!, 0.3) : PLAYER_COLORS[index]!;
        c.fill();

        if (ctx.theme.colorblind) {
          centerText(c, PLAYER_GLYPHS[index]!, x, y,
            `600 ${Math.round(cell * 0.3)}px system-ui, sans-serif`, '#0F1C3F');
        }
      }
    }

    // Padající žeton nad deskou.
    if (falling) {
      const target = cellCenter(falling.col, falling.row);
      const from = originY - cell * 0.5;
      const eased = easing.outBounce(clamp01(falling.progress));
      const y = from + (target.y - from) * eased;
      c.beginPath();
      c.arc(target.x, y, cell * 0.38, 0, Math.PI * 2);
      c.fillStyle = PLAYER_COLORS[falling.player - 1]!;
      c.fill();
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (versusComputer && game.state.current !== 1) return;
    const local = surface.toLogical(e.clientX, e.clientY);
    const col = Math.floor((local.x - originX) / cell);
    if (col >= 0 && col < CTYRI_COLS) {
      cursor = col;
      dropAt(col);
    }
  };
  surface.canvas.addEventListener('pointerup', onPointerUp);

  const loop = createLoop(
    {
      update() {
        input.sample();

        if (falling) {
          falling.progress += ctx.theme.reducedMotion ? 1 : 0.12;
          if (falling.progress >= 1) {
            falling = null;
            ctx.audio.play('lock');
            if (game.state.winner || game.state.draw) finish();
            else if (versusComputer && game.state.current === 2) aiTimer = AI_THINK_TICKS;
          }
          return;
        }

        if (aiTimer > 0) {
          if (--aiTimer === 0) dropAt(game.aiMove(difficulty));
          return;
        }

        if (game.state.winner || game.state.draw) return;

        const myTurn = !versusComputer || game.state.current === 1;
        if (!myTurn) return;

        if (input.repeated('left')) cursor = Math.max(0, cursor - 1);
        if (input.repeated('right')) cursor = Math.min(CTYRI_COLS - 1, cursor + 1);
        if (input.pressed('a')) dropAt(cursor);
        if (input.pressed('b')) {
          // Proti počítači se vrací obojí, aby byl hráč zase na tahu.
          game.undo();
          if (versusComputer) game.undo();
          finished = false;
          ctx.audio.play('tick');
        }
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
      game = createCtyriVRade(ctx.seed);
      finished = false;
      falling = null;
      aiTimer = 0;
      cursor = Math.floor(CTYRI_COLS / 2);
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
