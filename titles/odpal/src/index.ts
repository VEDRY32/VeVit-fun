/** Odpal — čistá geometrie, barva podle strany. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, centerText, withAlpha, roundRect,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createOdpal, FIELD_W, FIELD_H, BALL_RADIUS, WIN_SCORE,
  type Side, type OdpalMode, type Difficulty,
} from '@vevit-games/rules/odpal';
import { manifest } from './manifest.js';

/** Každá strana má vlastní barvu — ve čtyřech je to jediné rozlišení. */
const SIDE_COLORS: Record<Side, string> = {
  vlevo: paleta.zelena,
  vpravo: herniPaleta.cervena,
  nahore: herniPaleta.indigo,
  dole: herniPaleta.zluta,
};

export { manifest };

export const keymap: Partial<Keymap> = {
  // Hráč 1 (vlevo)
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  // Hráč 2 (vpravo)
  y: ['KeyW'],
  b: ['KeyS'],
  // Hráči 3 a 4 (nahoře a dole) ve čtyřhře
  l: ['KeyA'],
  r: ['KeyD'],
  x: ['KeyJ'],
  a: ['KeyL'],
};

export const touchButtons = [
  { action: 'up', label: '▲', x: 8, y: 30, size: 58 },
  { action: 'down', label: '▼', x: 8, y: 72, size: 58 },
  { action: 'y', label: '▲', x: 92, y: 30, size: 58 },
  { action: 'b', label: '▼', x: 92, y: 72, size: 58 },
];

export const controlHints = [
  { action: 'up', label: 'Levá pálka', keys: '↑ ↓' },
  { action: 'y', label: 'Pravá pálka', keys: 'W S' },
];

function modeConfig(mode: string): { odpal: OdpalMode; difficulty: Difficulty } {
  if (mode === 'dva-hraci') return { odpal: 'dva-hraci', difficulty: 'stredni' };
  if (mode === 'ctyri') return { odpal: 'ctyri', difficulty: 'stredni' };
  return { odpal: 'proti-pocitaci', difficulty: mode as Difficulty };
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);

  const scale = Math.min(width / FIELD_W, height / FIELD_H);
  c.save();
  c.translate((width - FIELD_W * scale) / 2, (height - FIELD_H * scale) / 2);
  c.scale(scale, scale);

  // Přerušovaná osa uprostřed.
  c.strokeStyle = 'rgba(238,242,255,0.18)';
  c.lineWidth = 3;
  c.setLineDash([12, 14]);
  c.beginPath();
  c.moveTo(FIELD_W / 2, 0);
  c.lineTo(FIELD_W / 2, FIELD_H);
  c.stroke();
  c.setLineDash([]);

  // Míček létá tam a zpět, pálky ho sledují.
  const cycle = (t * 0.9) % 2;
  const progress = cycle < 1 ? cycle : 2 - cycle;
  const ballX = 60 + progress * (FIELD_W - 120);
  const ballY = FIELD_H / 2 + Math.sin(t * 2.6) * 110;

  c.fillStyle = SIDE_COLORS.vlevo;
  roundRect(c, 24, ballY - 38, 12, 76, 6);
  c.fill();
  c.fillStyle = SIDE_COLORS.vpravo;
  roundRect(c, FIELD_W - 36, FIELD_H - ballY - 38, 12, 76, 6);
  c.fill();

  c.fillStyle = paleta.text;
  c.beginPath();
  c.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
  c.fill();

  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: FIELD_W, logicalHeight: FIELD_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;
  const config = modeConfig(ctx.mode);

  let game = createOdpal(ctx.seed, config.odpal, config.difficulty);
  let finished = false;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    const playerWon = game.state.winner === 'vlevo';
    ctx.audio.play(playerWon ? 'win' : 'lose');
    ctx.emit({
      type: playerWon ? 'win' : 'gameover',
      score: game.state.paddles.find((p) => p.side === 'vlevo')?.score ?? 0,
      durationMs: Math.round((game.state.tick * 1000) / 60),
    });
  };

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, FIELD_W, FIELD_H);

    if (config.odpal !== 'ctyri') {
      c.strokeStyle = withAlpha(ctx.theme.text, 0.14);
      c.lineWidth = 3;
      c.setLineDash([12, 14]);
      c.beginPath();
      c.moveTo(FIELD_W / 2, 0);
      c.lineTo(FIELD_W / 2, FIELD_H);
      c.stroke();
      c.setLineDash([]);
    }

    // Skóre: u dvou hráčů velké po stranách, u čtyř malé u příslušné pálky.
    c.textBaseline = 'middle';
    if (config.odpal === 'ctyri') {
      for (const paddle of game.state.paddles) {
        c.fillStyle = SIDE_COLORS[paddle.side];
        c.font = '600 16px system-ui, sans-serif';
        const positions: Record<Side, [number, number, CanvasTextAlign]> = {
          vlevo: [14, FIELD_H / 2, 'left'],
          vpravo: [FIELD_W - 14, FIELD_H / 2, 'right'],
          nahore: [FIELD_W / 2, 14, 'center'],
          dole: [FIELD_W / 2, FIELD_H - 14, 'center'],
        };
        const [x, y, align] = positions[paddle.side];
        c.textAlign = align;
        c.fillText(String(paddle.score), x, y);
      }
    } else {
      c.font = '700 44px ui-monospace, monospace';
      c.textAlign = 'right';
      c.fillStyle = withAlpha(SIDE_COLORS.vlevo, 0.85);
      c.fillText(String(game.state.paddles[0]!.score), FIELD_W / 2 - 30, 46);
      c.textAlign = 'left';
      c.fillStyle = withAlpha(SIDE_COLORS.vpravo, 0.85);
      c.fillText(String(game.state.paddles[1]!.score), FIELD_W / 2 + 30, 46);
    }

    for (const paddle of game.state.paddles) {
      const rect = game.paddleRect(paddle);
      c.fillStyle = SIDE_COLORS[paddle.side];
      roundRect(c, rect.x, rect.y, rect.w, rect.h, 6);
      c.fill();
    }

    // Během pauzy před podáním míček bliká, ať je vidět, že se čeká.
    const hidden = game.state.serveTimer > 0 && Math.floor(game.state.tick / 8) % 2 === 0;
    if (!hidden) {
      c.fillStyle = ctx.theme.text;
      c.beginPath();
      c.arc(game.state.ballX, game.state.ballY, BALL_RADIUS, 0, Math.PI * 2);
      c.fill();
    }

    if (game.state.over) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.84);
      c.fillRect(0, 0, FIELD_W, FIELD_H);
      const winner = game.state.winner!;
      const label = config.odpal === 'proti-pocitaci'
        ? (winner === 'vlevo' ? 'Vyhrál jsi' : 'Vyhrál počítač')
        : `Vyhrála strana ${winner}`;
      centerText(c, label, FIELD_W / 2, FIELD_H / 2 - 14,
        '600 30px system-ui, sans-serif', SIDE_COLORS[winner]);
      centerText(c, `Hraje se do ${WIN_SCORE} bodů`, FIELD_W / 2, FIELD_H / 2 + 22,
        '500 14px system-ui, sans-serif', ctx.theme.textMuted);
    }
  };

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();

        const inputs: Partial<Record<Side, number>> = {
          vlevo: (input.held('down') ? 1 : 0) - (input.held('up') ? 1 : 0),
          vpravo: (input.held('b') ? 1 : 0) - (input.held('y') ? 1 : 0),
        };
        if (config.odpal === 'ctyri') {
          inputs.nahore = (input.held('r') ? 1 : 0) - (input.held('l') ? 1 : 0);
          inputs.dole = (input.held('a') ? 1 : 0) - (input.held('x') ? 1 : 0);
        }

        const beforeScores = game.state.paddles.map((p) => p.score).join(',');
        const beforeRallies = game.state.rallies;
        game.step(inputs);

        if (game.state.rallies > beforeRallies) ctx.audio.play('click');
        if (game.state.paddles.map((p) => p.score).join(',') !== beforeScores) {
          ctx.audio.play('error');
          ctx.emit({
            type: 'score',
            value: game.state.paddles.find((p) => p.side === 'vlevo')?.score ?? 0,
          });
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

  // Na dotyku řídí levou pálku tažení prstem po levé polovině plochy.
  const onPointerMove = (e: PointerEvent): void => {
    const local = surface.toLogical(e.clientX, e.clientY);
    if (local.x > FIELD_W / 2) return;
    const left = game.state.paddles.find((p) => p.side === 'vlevo');
    if (left) left.position = local.y;
  };
  surface.canvas.addEventListener('pointermove', onPointerMove);

  loop.start();
  ctx.emit({ type: 'ready' });
  ctx.emit({ type: 'started' });

  return {
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    restart() {
      game = createOdpal(ctx.seed, config.odpal, config.difficulty);
      finished = false;
      loop.resume();
      ctx.emit({ type: 'started' });
    },
    destroy() {
      loop.stop();
      surface.canvas.removeEventListener('pointermove', onPointerMove);
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, touchButtons, controlHints };
