/** Lovec území — zabírání plochy obkreslováním. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createReplayRecorder, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createLovecUzemi, GRID_W, GRID_H, WIN_RATIO,
  type LovecGame, type Enemy,
} from '@vevit-games/rules/lovec-uzemi';
import { manifest } from './manifest.js';

const CELL = 20;
const HEADER = 56;
const VIEW_W = GRID_W * CELL;
const VIEW_H = GRID_H * CELL + HEADER;

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
};

export const touchButtons = [
  { action: 'left', label: '←', x: 12, y: 80 },
  { action: 'right', label: '→', x: 32, y: 80 },
  { action: 'up', label: '↑', x: 82, y: 68 },
  { action: 'down', label: '↓', x: 82, y: 90 },
];

export const controlHints = [
  { action: 'left', label: 'Pohyb', keys: '← ↑ → ↓' },
];

/** Zabraná plocha má jemnou texturu, ať je poznat od pozadí. */
function drawClaimed(ctx: CanvasRenderingContext2D, x: number, y: number, accent: string): void {
  ctx.fillStyle = withAlpha(accent, 0.22);
  ctx.fillRect(x, y, CELL, CELL);
  ctx.fillStyle = withAlpha(accent, 0.5);
  ctx.fillRect(x + CELL / 2 - 1, y + CELL / 2 - 1, 2, 2);
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number, phase: number): void {
  const color = enemy.kind === 'lovec' ? herniPaleta.ruzova : herniPaleta.cervena;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (enemy.kind === 'lovec') {
    // Lovec je hranatý, aby šel odlišit od poletujících.
    const r = CELL * 0.34;
    ctx.rect(x - r, y - r, r * 2, r * 2);
  } else {
    ctx.arc(x, y, CELL * 0.34, 0, Math.PI * 2);
  }
  ctx.fill();

  // Dvě oči, které se dívají ve směru letu.
  ctx.fillStyle = paleta.noc;
  const look = enemy.kind === 'lovec' ? 0 : Math.sign(enemy.vx) * 2;
  for (const dx of [-4, 4]) {
    ctx.beginPath();
    ctx.arc(x + dx * 0.6 + look, y - 1 + Math.sin(phase * 0.2) * 0.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);

  const scale = Math.min(width / VIEW_W, height / (VIEW_H - HEADER));
  c.save();
  c.translate((width - GRID_W * CELL * scale) / 2, (height - GRID_H * CELL * scale) / 2);
  c.scale(scale, scale);

  // Zabraný okraj a rostoucí zabraný obdélník.
  const grow = Math.floor((t * 3) % 12) + 2;
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const edge = x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1;
      const claimed = edge || (x < grow && y > 2 && y < GRID_H - 3);
      if (claimed) drawClaimed(c, x * CELL, y * CELL, herniPaleta.oranzova);
    }
  }

  c.fillStyle = herniPaleta.zluta;
  c.fillRect(grow * CELL + 4, (GRID_H / 2) * CELL + 4, CELL - 8, CELL - 8);
  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const game: LovecGame = createLovecUzemi(ctx.seed);
  const recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode: ctx.mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let lastScore = 0;
  let lastLives = game.state.lives;
  let lastLevel = game.state.level;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('lose');
    const durationMs = game.state.tick * (1000 / 60);
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score: game.state.score, durationMs,
      replay: recorder.finish(),
      stats: { uroven: game.state.level + 1 },
    });
    ctx.emit({
      type: 'gameover', score: game.state.score, durationMs,
      stats: { uroven: game.state.level + 1 },
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
    c.fillText(`Úroveň ${game.state.level + 1}`, 14, HEADER / 2);

    c.textAlign = 'center';
    c.fillStyle = ctx.theme.text;
    c.font = '600 20px system-ui, sans-serif';
    c.fillText(String(game.state.score), VIEW_W / 2, HEADER / 2);

    c.textAlign = 'right';
    c.font = '500 14px system-ui, sans-serif';
    c.fillStyle = herniPaleta.cervena;
    c.fillText('♥'.repeat(Math.max(0, game.state.lives)), VIEW_W - 14, HEADER / 2);

    // Pruh postupu k cíli úrovně.
    const barW = 120;
    const barX = VIEW_W / 2 - barW / 2;
    c.fillStyle = withAlpha(ctx.theme.text, 0.12);
    c.fillRect(barX, HEADER - 12, barW, 4);
    c.fillStyle = ctx.theme.accent;
    c.fillRect(barX, HEADER - 12, barW * Math.min(1, game.state.filled / WIN_RATIO), 4);

    c.save();
    c.translate(0, HEADER);

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const cell = game.cellAt(x, y);
        if (cell === 'zabrano') drawClaimed(c, x * CELL, y * CELL, ctx.theme.accent);
        else if (cell === 'stopa') {
          c.fillStyle = withAlpha(herniPaleta.zluta, 0.75);
          c.fillRect(x * CELL + 3, y * CELL + 3, CELL - 6, CELL - 6);
        }
      }
    }

    const phase = game.state.tick;
    for (const enemy of game.state.enemies) {
      drawEnemy(c, enemy, enemy.x * CELL, enemy.y * CELL, phase);
    }

    // Hráč bliká, dokud trvá nehybnost po ztrátě života.
    const blink = game.state.respawnTimer > 0 && Math.floor(phase / 6) % 2 === 0;
    if (!blink) {
      c.fillStyle = herniPaleta.zluta;
      c.fillRect(game.state.player.x * CELL + 2, game.state.player.y * CELL + 2, CELL - 4, CELL - 4);
      c.fillStyle = paleta.noc;
      c.fillRect(game.state.player.x * CELL + 7, game.state.player.y * CELL + 7, CELL - 14, CELL - 14);
    }

    c.restore();

    if (game.state.levelDone) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.8);
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      centerText(c, `Úroveň ${game.state.level + 1} hotová`, VIEW_W / 2, VIEW_H / 2,
        '600 26px system-ui, sans-serif', ctx.theme.accent);
    }
  };

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();
        const mask = input.snapshot();
        recorder.record(mask);
        game.step(mask);

        if (game.state.score !== lastScore) {
          if (game.state.score > lastScore) ctx.audio.play('pickup');
          lastScore = game.state.score;
          ctx.emit({ type: 'score', value: lastScore });
        }
        if (game.state.lives !== lastLives) {
          lastLives = game.state.lives;
          ctx.audio.play('hit');
        }
        if (game.state.level !== lastLevel) {
          lastLevel = game.state.level;
          ctx.audio.play('levelUp');
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
    destroy() {
      loop.stop();
      surface.destroy();
    },
  };
}

export const module_: GameModule = {
  manifest, mount, renderAttract, keymap, touchButtons, controlHints,
};
