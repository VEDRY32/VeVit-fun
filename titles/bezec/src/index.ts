/**
 * Běžec.
 *
 * Vykreslování je v samostatném modulu, protože ho sdílí i offline stránka
 * portálu — ta běží bez herního kontextu, bez API a bez zvuku.
 */

import {
  createLoop, createSurface, createReplayRecorder,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import { createBezec, WORLD_W, WORLD_H } from '@vevit-games/rules/bezec';
import { manifest } from './manifest.js';
import { drawBezec, renderAttract } from './render.js';

export { manifest, renderAttract };

export const keymap: Partial<Keymap> = {
  a: ['Space'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
};

/** Skok je celá horní polovina plochy, krčení spodní — bez viditelných tlačítek. */
export const touchButtons = [
  { action: 'a', label: '', x: 50, y: 30, size: 0 },
];

export const controlHints = [
  { action: 'a', label: 'Skok', keys: 'mezerník / tap' },
  { action: 'down', label: 'Přikrčení', keys: '↓' },
];

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: WORLD_W, logicalHeight: WORLD_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  let game = createBezec(ctx.seed);
  let recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode: ctx.mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let lastScore = 0;
  const best = ctx.scores.localBest(ctx.mode);

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
        // Skok po konci hry rovnou spustí nový běh — čekání na tlačítko
        // v rychlé hře jen zdržuje. O nový běh si musí říct portál:
        // jen ten umí sehnat nový seed a nové run_id.
        if (finished) {
          if (input.pressed('a') || input.pressed('up')) ctx.emit({ type: 'restart' });
          return;
        }

        const mask = input.snapshot();
        recorder.record(mask);
        game.step(mask);

        if (game.state.score !== lastScore) {
          lastScore = game.state.score;
          // Pípnutí každých sto bodů, ne při každém kroku.
          if (lastScore > 0 && lastScore % 100 === 0) ctx.audio.play('tick');
          ctx.emit({ type: 'score', value: lastScore });
        }
        if (game.state.over) finish();
      },
      render() {
        surface.begin();
        drawBezec(surface.ctx, game, { showHint: true, bestScore: best });
      },
    },
    { onAutoPause: () => ctx.emit({ type: 'paused' }) },
  );

  // Tap na horní polovinu skáče, na spodní krčí.
  const onPointerDown = (e: PointerEvent): void => {
    const local = surface.toLogical(e.clientX, e.clientY);
    input.setVirtual(local.y > WORLD_H * 0.6 ? 'down' : 'a', true);
  };
  const onPointerUp = (): void => {
    input.setVirtual('a', false);
    input.setVirtual('down', false);
  };
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
