/**
 * Kuličkodráha — propojení pravidel, enginu a vykreslování.
 */

import {
  createLoop, createSurface, createReplayRecorder,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import { createKulickodraha } from '@vevit-games/rules/kulickodraha';
import { manifest } from './manifest.js';
import { renderKulickodraha, renderAttract, VIEW_WIDTH, VIEW_HEIGHT, type KulickodrahaTheme } from './render.js';

export { manifest, renderAttract };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  a: ['Space'],
};

export const touchButtons = [
  { action: 'left', label: '◀', x: 14, y: 84, size: 62 },
  { action: 'right', label: '▶', x: 28, y: 84, size: 62 },
  { action: 'a', label: '⤒', x: 86, y: 84, size: 62 },
];

export const controlHints = [
  { action: 'left', label: 'Řízení do stran', keys: '← →' },
  { action: 'a', label: 'Skok', keys: 'mezerník' },
];

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_WIDTH, logicalHeight: VIEW_HEIGHT, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const game = createKulickodraha(ctx.seed);
  const recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode: ctx.mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let lastScore = 0;
  const best = ctx.scores.localBest(ctx.mode);

  const theme: KulickodrahaTheme = {
    accent: ctx.theme.accent,
    background: ctx.theme.background,
    text: ctx.theme.text,
    textMuted: ctx.theme.textMuted,
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('lose');
    const durationMs = Math.round((game.state.tick * 1000) / 60);
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score: game.state.score, durationMs,
      replay: recorder.finish(),
    });
    ctx.emit({ type: 'gameover', score: game.state.score, durationMs });
  };

  const loop = createLoop(
    {
      update() {
        input.sample();
        if (finished) {
          if (input.pressed('a')) ctx.emit({ type: 'restart' });
          return;
        }
        const mask = input.snapshot();
        recorder.record(mask);
        game.step(mask);

        if (game.state.score !== lastScore) {
          lastScore = game.state.score;
          ctx.emit({ type: 'score', value: lastScore });
        }
        if (game.state.over) finish();
      },
      render() {
        surface.begin();
        renderKulickodraha(surface.ctx, game, theme, { bestScore: best });
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

export const module_: GameModule = { manifest, mount, renderAttract, keymap, touchButtons, controlHints };
