/** Mávník — papírový drak nad městem s paralaxou. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createReplayRecorder, roundRect, centerText, withAlpha, shade,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import { createMavnik, WORLD_W, WORLD_H, BIRD_X, type MavnikMode } from '@vevit-games/rules/mavnik';
import { toFloat } from '@vevit-games/engine';
import { manifest } from './manifest.js';

const BIRD_SCREEN_X = toFloat(BIRD_X);
const PIPE_COLOR = herniPaleta.kamen;
const SKY_TOP = paleta.pultSvetly;

export { manifest };

export const keymap: Partial<Keymap> = {
  a: ['Space'],
  up: ['ArrowUp', 'KeyW'],
};

/** Jediné tlačítko přes celou plochu: tapnutí kamkoliv mávne. */
export const touchButtons = [
  { action: 'a', label: '', x: 50, y: 50, size: 0 },
];

export const controlHints = [
  { action: 'a', label: 'Mávnout', keys: 'mezerník / tap' },
];

/** Siluety domů — deterministické, aby pozadí nepoblikávalo mezi snímky. */
function drawSkyline(
  ctx: CanvasRenderingContext2D,
  offset: number, baseY: number, height: number, color: string, step: number,
): void {
  ctx.fillStyle = color;
  const start = Math.floor(offset / step) * step - offset;
  for (let x = start; x < WORLD_W + step; x += step) {
    const index = Math.round((x + offset) / step);
    const noise = Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1;
    const h = height * (0.45 + noise * 0.55);
    ctx.fillRect(x, baseY - h, step - 3, h);
  }
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;

  const gradient = c.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, SKY_TOP);
  gradient.addColorStop(1, paleta.noc);
  c.fillStyle = gradient;
  c.fillRect(0, 0, width, height);

  const scale = height / WORLD_H;
  c.save();
  c.scale(scale, scale);
  const view = width / scale;

  drawSkyline(c, t * 14, WORLD_H, 150, paleta.pultSvetly, 46);
  drawSkyline(c, t * 26, WORLD_H, 100, paleta.linka, 34);

  // Dvojice stožárů, které pomalu ujíždějí doleva.
  for (let i = 0; i < 3; i++) {
    const x = ((view + 200 - (t * 60 + i * 190)) % (view + 240)) - 60;
    const center = WORLD_H / 2 + Math.sin(i * 2.1) * 110;
    c.fillStyle = PIPE_COLOR;
    c.fillRect(x, 0, 58, center - 88);
    c.fillRect(x, center + 88, 58, WORLD_H);
  }

  // Drak s ocáskem, náklon podle fáze.
  const y = WORLD_H / 2 + Math.sin(t * 3) * 70;
  const tilt = Math.cos(t * 3) * 0.35;
  c.save();
  c.translate(BIRD_SCREEN_X, y);
  c.rotate(tilt);
  c.fillStyle = herniPaleta.zluta;
  c.beginPath();
  c.moveTo(16, 0);
  c.lineTo(0, -14);
  c.lineTo(-14, 0);
  c.lineTo(0, 14);
  c.closePath();
  c.fill();
  c.strokeStyle = withAlpha(herniPaleta.zluta, 0.7);
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-14, 0);
  c.quadraticCurveTo(-30, 8, -40, 0);
  c.stroke();
  c.restore();

  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: WORLD_W, logicalHeight: WORLD_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;
  const mode = ctx.mode as MavnikMode;

  let game = createMavnik(ctx.seed, mode);
  let recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let lastScore = 0;
  let scroll = 0;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('lose');
    const durationMs = Math.round((game.state.tick * 1000) / 60);
    void ctx.scores.submit({
      runId: null, mode, score: game.state.score, durationMs,
      replay: recorder.finish(),
    });
    ctx.emit({ type: 'gameover', score: game.state.score, durationMs });
  };

  const draw = (): void => {
    const c = surface.ctx;

    const gradient = c.createLinearGradient(0, 0, 0, WORLD_H);
    gradient.addColorStop(0, SKY_TOP);
    gradient.addColorStop(1, ctx.theme.background);
    c.fillStyle = gradient;
    c.fillRect(0, 0, WORLD_W, WORLD_H);

    // Paralaxa: vzdálenější vrstva se posouvá pomaleji.
    if (!ctx.theme.lowQuality) {
      drawSkyline(c, scroll * 0.25, WORLD_H, 150, paleta.pultSvetly, 46);
      drawSkyline(c, scroll * 0.55, WORLD_H, 100, paleta.linka, 34);
    }

    for (const rect of game.pipeRects()) {
      c.fillStyle = PIPE_COLOR;
      roundRect(c, rect.x, rect.y, rect.w, rect.h, 4);
      c.fill();
      // Světlejší hrana u mezery — hráč tak líp odhadne, kam se vejde.
      c.fillStyle = shade(PIPE_COLOR, 0.22);
      const edgeY = rect.y === 0 ? rect.y + rect.h - 10 : rect.y;
      c.fillRect(rect.x - 4, edgeY, rect.w + 8, 10);
    }

    const y = game.birdY();
    c.save();
    c.translate(BIRD_SCREEN_X, y);
    c.rotate(game.state.rotation);
    c.fillStyle = ctx.theme.accent;
    c.beginPath();
    c.moveTo(16, 0);
    c.lineTo(0, -14);
    c.lineTo(-14, 0);
    c.lineTo(0, 14);
    c.closePath();
    c.fill();
    c.strokeStyle = withAlpha(ctx.theme.accent, 0.7);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-14, 0);
    c.quadraticCurveTo(-30, 10, -40, 2);
    c.stroke();
    c.restore();

    centerText(c, String(game.state.score), WORLD_W / 2, 56,
      '700 46px system-ui, sans-serif', ctx.theme.text, withAlpha(ctx.theme.background, 0.8));

    if (!game.state.started) {
      centerText(c, 'Mávni a leť', WORLD_W / 2, WORLD_H / 2 + 90,
        '600 20px system-ui, sans-serif', ctx.theme.textMuted);
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
        if (game.state.started && !game.state.over) scroll += 2.6;

        if (game.state.score !== lastScore) {
          ctx.audio.play('pickup');
          lastScore = game.state.score;
          ctx.emit({ type: 'score', value: lastScore });
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

  // Tapnutí kamkoliv na plochu je mávnutí — na mobilu nejpřirozenější.
  const onPointerDown = (): void => input.setVirtual('a', true);
  const onPointerUp = (): void => input.setVirtual('a', false);
  surface.canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

  loop.start();
  ctx.emit({ type: 'ready' });
  ctx.emit({ type: 'started' });

  return {
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    destroy() {
      loop.stop();
      surface.canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, touchButtons, controlHints };
