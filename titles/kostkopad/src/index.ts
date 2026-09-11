/**
 * Kostkopád — propojení pravidel, enginu a vykreslování.
 *
 * Pravidla žijí v @vevit-games/rules, aby je server mohl přehrát. Tady je
 * jen smyčka, vstup, zvuk a obraz.
 */

import {
  createLoop, createSurface, createParticles, createRng, createReplayRecorder,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import { createKostkopad, PIECE_COLORS, type KostkopadMode } from '@vevit-games/rules';
import { manifest } from './manifest.js';
import {
  renderKostkopad, renderAttract, VIEW_WIDTH, VIEW_HEIGHT,
  BOARD_X, BOARD_Y, CELL, type RenderTheme,
} from './render.js';

/**
 * Vlastní rozložení kláves podle zadání: ↑/X rotace doprava, Z doleva,
 * A o 180°, C/Shift držení, mezerník tvrdý pád. Portál ho použije při
 * vytváření vstupu.
 */
export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  down: ['ArrowDown'],
  up: ['ArrowUp'],
  x: ['KeyX'],
  b: ['KeyZ'],
  l: ['KeyA'],
  y: ['KeyC', 'ShiftLeft'],
  a: ['Space'],
  select: ['Escape'],
  start: ['Enter'],
  r: [],
};

export { manifest };
export { renderAttract };

/**
 * Rozmístění respektuje hrací pole: to leží mezi 29 % a 76 % šířky a končí
 * na 89 % výšky. Tlačítka jsou proto v postranních pruzích a pod polem,
 * aby hráč viděl, kam tvar dopadá.
 */
export const touchButtons = [
  { action: 'left', label: '◀', x: 7, y: 84, size: 62 },
  { action: 'right', label: '▶', x: 21, y: 84, size: 62 },
  { action: 'down', label: '▼', x: 14, y: 95, size: 62 },
  { action: 'b', label: '↺', x: 79, y: 84, size: 62 },
  { action: 'x', label: '↻', x: 93, y: 84, size: 62 },
  { action: 'a', label: '⤓', x: 86, y: 95, size: 62 },
  { action: 'y', label: 'DRŽ', x: 93, y: 70, size: 54 },
];

export const controlHints = [
  { action: 'left', label: 'Posun do stran', keys: '← →' },
  { action: 'x', label: 'Otočení', keys: '↑ / X / Z' },
  { action: 'down', label: 'Měkký pád', keys: '↓' },
  { action: 'a', label: 'Tvrdý pád', keys: 'mezerník' },
  { action: 'y', label: 'Držení kusu', keys: 'C' },
];

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_WIDTH,
    logicalHeight: VIEW_HEIGHT,
    letterbox: ctx.theme.background,
  });

  const { input } = ctx;

  // Částice jsou dekorace, ne herní logika — vlastní generátor, aby
  // nepohnuly stavem RNG, ze kterého se berou tvary.
  const particles = ctx.theme.lowQuality ? null : createParticles(createRng(`${ctx.seed}:castice`), 300);

  const theme: RenderTheme = {
    accent: ctx.theme.accent,
    background: ctx.theme.background,
    surface: ctx.theme.surface,
    text: ctx.theme.text,
    textMuted: ctx.theme.textMuted,
    colorblind: ctx.theme.colorblind,
    lowQuality: ctx.theme.lowQuality,
  };

  const mode = ctx.mode as KostkopadMode;
  let game = createKostkopad(ctx.seed, { mode });
  let recorder = createReplayRecorder({
    gameSlug: manifest.slug,
    mode,
    seed: ctx.seed,
    rulesVersion: manifest.rulesVersion,
    clientVersion: __APP_VERSION__,
  });
  let startTick = 0;
  let finished = false;
  let lastScore = 0;
  let lastLinesCount = 0;

  const emitClearEffects = (): void => {
    const clear = game.state.lastClear;
    if (!clear || clear.lines === 0 || !particles) return;
    for (const row of clear.rows) {
      for (let x = 0; x < 10; x++) {
        particles.emit({
          x: BOARD_X + x * CELL + CELL / 2,
          y: BOARD_Y + (row - 2) * CELL + CELL / 2,
          count: 4,
          color: game.state.active ? PIECE_COLORS[game.state.active.type] : ctx.theme.accent,
          speed: 2.4,
          life: 26,
          size: 5,
        });
      }
    }
    ctx.audio.play(clear.lines >= 4 ? 'levelUp' : 'clear');
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    const durationMs = Math.round(((game.state.tick - startTick) * 1000) / 60);
    const score = mode === 'sprint40' ? durationMs : game.state.score;
    const won = game.state.won;

    ctx.audio.play(won ? 'win' : 'lose');
    void ctx.scores.submit({
      runId: null,
      mode,
      score,
      durationMs,
      replay: recorder.finish(),
      stats: { lines: game.state.lines, level: game.state.level },
    });
    ctx.emit({
      type: won ? 'win' : 'gameover',
      score,
      durationMs,
      stats: { lines: game.state.lines, level: game.state.level },
    });
  };

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();
        const mask = input.snapshot();
        recorder.record(mask);

        const linesBefore = game.state.lines;
        game.step(mask);
        particles?.update();

        if (game.state.lines !== linesBefore) emitClearEffects();
        if (game.state.score !== lastScore) {
          lastScore = game.state.score;
          ctx.emit({ type: 'score', value: lastScore });
        }
        if (game.state.lines !== lastLinesCount) lastLinesCount = game.state.lines;

        if (game.state.over || game.state.won) finish();
      },
      render(alpha) {
        surface.begin();
        renderKostkopad(surface.ctx, game, theme, particles, alpha);
      },
    },
    { onAutoPause: () => ctx.emit({ type: 'paused' }) },
  );

  loop.start();
  ctx.emit({ type: 'ready' });
  ctx.emit({ type: 'started' });

  return {
    pause() {
      loop.pause();
    },
    resume() {
      loop.resume();
    },
    restart() {
      game = createKostkopad(ctx.seed, { mode });
      recorder = createReplayRecorder({
        gameSlug: manifest.slug,
        mode,
        seed: ctx.seed,
        rulesVersion: manifest.rulesVersion,
        clientVersion: __APP_VERSION__,
      });
      particles?.clear();
      finished = false;
      lastScore = 0;
      startTick = 0;
      loop.resume();
      ctx.emit({ type: 'started' });
    },
    destroy() {
      loop.stop();
      surface.destroy();
    },
    getSave() {
      // Maraton se dá odložit; hodnocené časovky ne — jinak by šlo
      // uložit před chybou a načíst zpátky.
      if (mode !== 'maraton') return null;
      return {
        board: game.state.board,
        score: game.state.score,
        lines: game.state.lines,
        level: game.state.level,
        hold: game.state.hold,
      };
    },
    loadSave(data) {
      const save = data as { board?: unknown; score?: number; lines?: number; level?: number } | null;
      if (!save?.board || !Array.isArray(save.board)) return false;
      game.state.board = save.board as typeof game.state.board;
      game.state.score = save.score ?? 0;
      game.state.lines = save.lines ?? 0;
      game.state.level = save.level ?? 1;
      return true;
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, touchButtons, controlHints };
