/** Cihlobijec — pádlo se ovládá myší, dotykem i klávesnicí. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createParticles, createRng,
  roundRect, centerText, withAlpha, shade,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createCihlobijec, FIELD_W, FIELD_H, BRICK_W, BRICK_H, BRICK_TOP,
  PADDLE_Y, PADDLE_H, BALL_RADIUS, type PowerupKind,
} from '@vevit-games/rules/cihlobijec';
import { manifest } from './manifest.js';

/** Barva cihly podle zbývajících vrstev; nerozbitná má vlastní odstín. */
const LAYER_COLORS = [herniPaleta.tyrkys, herniPaleta.zelena, herniPaleta.zluta];
const SOLID_COLOR = herniPaleta.kamen;

const POWERUP_LABELS: Record<PowerupKind, string> = {
  'siroke-padlo': 'Š',
  'vic-micku': '3',
  laser: 'L',
  lepidlo: 'G',
  zpomaleni: 'Z',
  prurazny: 'P',
};

const POWERUP_COLORS: Record<PowerupKind, string> = {
  'siroke-padlo': herniPaleta.zelena,
  'vic-micku': herniPaleta.indigo,
  laser: herniPaleta.ruzova,
  lepidlo: herniPaleta.zluta,
  zpomaleni: herniPaleta.tyrkys,
  prurazny: herniPaleta.fialova,
};

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  a: ['Space'],
};

export const controlHints = [
  { action: 'pointer', label: 'Pohyb pádla', keys: 'myš / prst' },
  { action: 'left', label: 'Pohyb pádla', keys: '← →' },
  { action: 'a', label: 'Vystřelit / laser', keys: 'mezerník' },
];

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

  // Cihly ubývají a zase se doplňují.
  const phase = (Math.sin(t * 0.5) + 1) / 2;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      const noise = Math.abs(Math.sin(col * 12.9898 + row * 78.233) * 43758.5453) % 1;
      if (noise > 0.25 + phase * 0.6) continue;
      const x = col * BRICK_W + 2;
      const y = BRICK_TOP + row * BRICK_H + 2;
      c.fillStyle = LAYER_COLORS[(col + row) % LAYER_COLORS.length]!;
      roundRect(c, x, y, BRICK_W - 4, BRICK_H - 4, 3);
      c.fill();
    }
  }

  const paddleX = FIELD_W / 2 + Math.sin(t * 1.6) * 120;
  c.fillStyle = paleta.text;
  roundRect(c, paddleX - 44, PADDLE_Y, 88, PADDLE_H, 6);
  c.fill();

  const ballY = 300 + Math.sin(t * 3.1) * 160;
  c.fillStyle = herniPaleta.zluta;
  c.beginPath();
  c.arc(paddleX + Math.cos(t * 3.1) * 90, ballY, BALL_RADIUS, 0, Math.PI * 2);
  c.fill();

  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: FIELD_W, logicalHeight: FIELD_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  let game = createCihlobijec(ctx.seed);
  const particles = ctx.theme.lowQuality
    ? null
    : createParticles(createRng(`${ctx.seed}:castice`), 250);

  let finished = false;
  let lastScore = 0;
  let lastBrickCount = game.remaining();
  // Cíl pádla drží ukazatel; klávesnice ho posouvá po krocích.
  let paddleTarget = FIELD_W / 2;

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
      score: game.state.score,
      durationMs,
      stats: { uroven: game.state.level + 1 },
    });
  };

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, FIELD_W, FIELD_H);

    // Hlavička: skóre, úroveň, životy.
    c.font = '500 14px system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText(`Úroveň ${game.state.level + 1}`, 14, 24);
    c.textAlign = 'center';
    c.fillStyle = ctx.theme.text;
    c.font = '600 20px system-ui, sans-serif';
    c.fillText(String(game.state.score), FIELD_W / 2, 24);
    c.textAlign = 'right';
    c.fillStyle = ctx.theme.accent;
    c.fillText('●'.repeat(Math.max(0, game.state.lives)), FIELD_W - 14, 24);

    for (const brick of game.state.bricks) {
      const x = brick.col * BRICK_W;
      const y = BRICK_TOP + brick.row * BRICK_H;
      const color = brick.solid
        ? SOLID_COLOR
        : LAYER_COLORS[Math.min(LAYER_COLORS.length - 1, brick.hits - 1)]!;

      c.fillStyle = color;
      roundRect(c, x + 2, y + 2, BRICK_W - 4, BRICK_H - 4, 3);
      c.fill();
      // Světlá horní hrana dává cihle objem bez stínu.
      c.fillStyle = withAlpha('#ffffff', 0.16);
      c.fillRect(x + 4, y + 4, BRICK_W - 8, 3);

      if (brick.powerup) {
        centerText(c, POWERUP_LABELS[brick.powerup], x + BRICK_W / 2, y + BRICK_H / 2,
          '700 11px system-ui, sans-serif', paleta.noc);
      }
    }

    particles?.render(c);

    for (const powerup of game.state.powerups) {
      c.fillStyle = POWERUP_COLORS[powerup.kind];
      roundRect(c, powerup.x - 13, powerup.y - 9, 26, 18, 5);
      c.fill();
      centerText(c, POWERUP_LABELS[powerup.kind], powerup.x, powerup.y,
        '700 12px system-ui, sans-serif', paleta.noc);
    }

    for (const laser of game.state.lasers) {
      c.fillStyle = herniPaleta.ruzova;
      c.fillRect(laser.x - 2, laser.y - 12, 4, 12);
    }

    // Pádlo: s aktivním lepidlem má jiný okraj, aby bylo poznat proč míček drží.
    c.fillStyle = ctx.theme.text;
    roundRect(c, game.state.paddleX - game.state.paddleW / 2, PADDLE_Y, game.state.paddleW, PADDLE_H, 6);
    c.fill();
    if (game.state.effects.lepidlo) {
      c.strokeStyle = POWERUP_COLORS.lepidlo;
      c.lineWidth = 2;
      c.stroke();
    }

    for (const ball of game.state.balls) {
      c.fillStyle = ball.piercing ? POWERUP_COLORS.prurazny : ctx.theme.accent;
      c.beginPath();
      c.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
      c.fill();
    }

    if (game.state.balls.some((b) => b.stuck)) {
      centerText(c, 'Mezerník nebo tap vystřelí', FIELD_W / 2, PADDLE_Y - 48,
        '500 14px system-ui, sans-serif', ctx.theme.textMuted);
    }
  };

  const onPointerMove = (e: PointerEvent): void => {
    paddleTarget = surface.toLogical(e.clientX, e.clientY).x;
  };
  const onPointerDown = (e: PointerEvent): void => {
    paddleTarget = surface.toLogical(e.clientX, e.clientY).x;
    input.setVirtual('a', true);
  };
  const onPointerUp = (): void => input.setVirtual('a', false);

  surface.canvas.addEventListener('pointermove', onPointerMove);
  surface.canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();

        if (input.held('left')) paddleTarget -= 9;
        if (input.held('right')) paddleTarget += 9;

        const action = input.pressed('a');
        game.step(paddleTarget, action, input.held('a'));
        particles?.update();

        // Zásah cihly rozsype částice v barvě, kterou cihla měla.
        const remaining = game.remaining();
        if (remaining !== lastBrickCount) {
          lastBrickCount = remaining;
          ctx.audio.play('hit');
          const ball = game.state.balls[0];
          particles?.emit({
            x: ball?.x ?? FIELD_W / 2,
            y: ball?.y ?? FIELD_H / 2,
            count: 8, color: ctx.theme.accent, speed: 2.6, life: 22, size: 4,
          });
        }

        if (game.state.score !== lastScore) {
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

  loop.start();
  ctx.emit({ type: 'ready' });
  ctx.emit({ type: 'started' });

  return {
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    destroy() {
      loop.stop();
      surface.canvas.removeEventListener('pointermove', onPointerMove);
      surface.canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, controlHints };
