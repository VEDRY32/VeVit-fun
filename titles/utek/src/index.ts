/** Útěk — běh třemi pruhy se stínem v zádech. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createReplayRecorder, roundRect, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createUtek, WORLD_W, WORLD_H, LANE_Y, RUNNER_X, RUNNER_W, RUNNER_H,
  type UtekGame, type Obstacle,
} from '@vevit-games/rules/utek';
import { manifest } from './manifest.js';

export { manifest };

export const keymap: Partial<Keymap> = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  a: ['Space'],
};

export const touchButtons = [
  { action: 'up', label: '↑', x: 14, y: 62 },
  { action: 'down', label: '↓', x: 14, y: 88 },
  { action: 'a', label: '⤒', x: 86, y: 80, size: 15 },
];

export const controlHints = [
  { action: 'up', label: 'Změna pruhu', keys: '↑ ↓' },
  { action: 'a', label: 'Přeskok', keys: 'mezerník' },
];

function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle, y: number): void {
  const { x, w, kind } = obstacle;
  if (kind === 'dira') {
    // Díra v podlaze: tmavý pruh s roztřepenými okraji.
    ctx.fillStyle = paleta.noc;
    roundRect(ctx, x, y - 10, w, 22, 6);
    ctx.fill();
    ctx.strokeStyle = withAlpha(herniPaleta.kamen, 0.8);
    ctx.lineWidth = 2;
    roundRect(ctx, x, y - 10, w, 22, 6);
    ctx.stroke();
    return;
  }
  if (kind === 'zavora') {
    ctx.fillStyle = herniPaleta.cervena;
    roundRect(ctx, x, y - 34, w, 44, 4);
    ctx.fill();
    ctx.fillStyle = withAlpha('#ffffff', 0.25);
    for (let i = 0; i < 3; i++) ctx.fillRect(x, y - 30 + i * 14, w, 5);
    return;
  }
  ctx.fillStyle = herniPaleta.hneda;
  roundRect(ctx, x, y - 26, w, 32, 4);
  ctx.fill();
  ctx.strokeStyle = withAlpha(paleta.noc, 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 26);
  ctx.lineTo(x + w, y + 6);
  ctx.moveTo(x + w, y - 26);
  ctx.lineTo(x, y + 6);
  ctx.stroke();
}

function drawRunner(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, phase: number, color: string, hurt: boolean,
): void {
  ctx.save();
  ctx.globalAlpha = hurt && Math.floor(phase / 4) % 2 === 0 ? 0.35 : 1;

  ctx.fillStyle = color;
  roundRect(ctx, x, y + 8, RUNNER_W, RUNNER_H - 8, 6);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + RUNNER_W / 2, y + 7, 8, 0, Math.PI * 2);
  ctx.fill();

  // Nohy v běhu a vlasy, které se táhnou dozadu.
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const swing = Math.sin(phase * 0.4) * 7;
  ctx.beginPath();
  ctx.moveTo(x + 7, y + RUNNER_H - 2);
  ctx.lineTo(x + 7 - swing, y + RUNNER_H + 6);
  ctx.moveTo(x + RUNNER_W - 7, y + RUNNER_H - 2);
  ctx.lineTo(x + RUNNER_W - 7 + swing, y + RUNNER_H + 6);
  ctx.stroke();

  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 4);
  ctx.quadraticCurveTo(x - 9, y + 1, x - 14, y + 8);
  ctx.stroke();

  ctx.fillStyle = paleta.noc;
  ctx.beginPath();
  ctx.arc(x + RUNNER_W / 2 + 3, y + 6, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Stín pronásledovatele: tmavá vlna, která se tlačí zleva. */
function drawChaser(ctx: CanvasRenderingContext2D, chase: number, phase: number): void {
  const edge = chase * (RUNNER_X + 60);
  const gradient = ctx.createLinearGradient(0, 0, edge, 0);
  gradient.addColorStop(0, withAlpha(herniPaleta.fialova, 0.55));
  gradient.addColorStop(1, withAlpha(paleta.noc, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, edge, WORLD_H);

  ctx.strokeStyle = withAlpha(herniPaleta.fialova, 0.8);
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let y = 0; y <= WORLD_H; y += 10) {
    const wave = Math.sin(y * 0.05 + phase * 0.08) * 9;
    if (y === 0) ctx.moveTo(edge + wave, y);
    else ctx.lineTo(edge + wave, y);
  }
  ctx.stroke();
}

function drawLanes(ctx: CanvasRenderingContext2D, offset: number, color: string): void {
  ctx.strokeStyle = withAlpha(color, 0.16);
  ctx.lineWidth = 2;
  for (const y of LANE_Y) {
    ctx.beginPath();
    ctx.moveTo(0, y + 12);
    ctx.lineTo(WORLD_W, y + 12);
    ctx.stroke();
  }

  // Ubíhající dlažba dává rychlosti měřítko.
  ctx.fillStyle = withAlpha(color, 0.1);
  const step = 60;
  for (let x = -(offset % step); x < WORLD_W; x += step) {
    for (const y of LANE_Y) ctx.fillRect(x, y + 8, 26, 3);
  }
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);

  const scale = Math.min(width / WORLD_W, height / WORLD_H);
  c.save();
  c.translate((width - WORLD_W * scale) / 2, (height - WORLD_H * scale) / 2);
  c.scale(scale, scale);

  drawLanes(c, t * 220, paleta.textTlumeny);
  const lane = Math.floor(t) % 3;
  drawObstacle(c, { kind: 'bedna', lane: 0, x: 420, w: 36, passed: false }, LANE_Y[0]!);
  drawObstacle(c, { kind: 'zavora', lane: 2, x: 560, w: 24, passed: false }, LANE_Y[2]!);
  drawRunner(c, RUNNER_X, LANE_Y[lane]! - RUNNER_H / 2, t * 60, herniPaleta.oranzova, false);
  drawChaser(c, 0.3 + Math.sin(t) * 0.08, t * 60);
  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: WORLD_W, logicalHeight: WORLD_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const game: UtekGame = createUtek(ctx.seed);
  const recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode: ctx.mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let lastScore = 0;
  let lastHit = 0;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('lose');
    const durationMs = game.state.tick * (1000 / 60);
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score: game.state.score, durationMs,
      replay: recorder.finish(),
      stats: { vzdalenost: Math.round(game.state.distance / 10) },
    });
    ctx.emit({
      type: 'gameover', score: game.state.score, durationMs,
      stats: { metry: Math.round(game.state.distance / 10) },
    });
  };

  const draw = (): void => {
    const c = surface.ctx;
    const s = game.state;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, WORLD_W, WORLD_H);

    drawLanes(c, s.distance, ctx.theme.textMuted);

    for (const obstacle of s.obstacles) {
      drawObstacle(c, obstacle, LANE_Y[obstacle.lane]!);
    }

    for (const pickup of s.pickups) {
      if (pickup.taken) continue;
      c.fillStyle = herniPaleta.zluta;
      c.beginPath();
      c.arc(pickup.x, LANE_Y[pickup.lane]! - 6, 9, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = paleta.noc;
      c.beginPath();
      c.arc(pickup.x, LANE_Y[pickup.lane]! - 6, 3.5, 0, Math.PI * 2);
      c.fill();
    }

    const r = game.runnerRect();
    drawRunner(c, r.x, r.y, s.tick, ctx.theme.accent, s.hitTicks > 0);
    drawChaser(c, s.chase, s.tick);

    // HUD: skóre a pruh, jak blízko je pronásledovatel.
    c.font = '600 22px system-ui, sans-serif';
    c.textAlign = 'right';
    c.textBaseline = 'top';
    c.fillStyle = ctx.theme.text;
    c.fillText(String(s.score), WORLD_W - 16, 14);

    c.fillStyle = withAlpha(ctx.theme.text, 0.12);
    roundRect(c, 16, 16, 180, 8, 4);
    c.fill();
    c.fillStyle = s.chase > 0.7 ? herniPaleta.cervena : herniPaleta.fialova;
    roundRect(c, 16, 16, Math.max(4, 180 * s.chase), 8, 4);
    c.fill();
    c.font = '500 12px system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText('Pronásledovatel', 16, 30);
  };

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();
        const mask = input.snapshot();
        recorder.record(mask);
        game.step(mask);

        if (game.state.hitTicks > lastHit) ctx.audio.play('hit');
        lastHit = game.state.hitTicks;

        if (game.state.score !== lastScore) {
          if (game.state.score - lastScore >= 100) ctx.audio.play('pickup');
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
