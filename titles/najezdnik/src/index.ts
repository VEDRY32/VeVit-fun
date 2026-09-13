/** Nájezdník — plošinovka se střelbou a posouvající se kamerou. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createReplayRecorder, roundRect, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createNajezdnik, TILE, MAX_HEALTH, type NajezdnikGame, type Enemy,
} from '@vevit-games/rules/najezdnik';
import { manifest } from './manifest.js';

const HEADER = 56;
const VIEW_W = 640;
const VIEW_H = 300;
const WORLD_H = VIEW_H - HEADER;

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  a: ['Space', 'KeyJ'],
};

export const touchButtons = [
  { action: 'left', label: '←', x: 12, y: 80 },
  { action: 'right', label: '→', x: 32, y: 80 },
  { action: 'up', label: '⤒', x: 70, y: 80 },
  { action: 'a', label: '◎', x: 90, y: 80, size: 15 },
];

export const controlHints = [
  { action: 'left', label: 'Pohyb', keys: '← →' },
  { action: 'up', label: 'Skok', keys: '↑' },
  { action: 'a', label: 'Střelba (↑ míří vzhůru)', keys: 'mezerník' },
];

function drawTileBlock(ctx: CanvasRenderingContext2D, x: number, y: number, char: string): void {
  if (char === '#') {
    ctx.fillStyle = herniPaleta.kamenTmavy;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = withAlpha('#ffffff', 0.06);
    ctx.fillRect(x, y, TILE, 2);
  } else if (char === '=') {
    ctx.fillStyle = herniPaleta.kamen;
    roundRect(ctx, x, y + 2, TILE, TILE - 8, 3);
    ctx.fill();
  } else if (char === '^') {
    ctx.fillStyle = herniPaleta.cervena;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * (TILE / 3), y + TILE);
      ctx.lineTo(x + (i + 0.5) * (TILE / 3), y + TILE * 0.4);
      ctx.lineTo(x + (i + 1) * (TILE / 3), y + TILE);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, phase: number): void {
  const b = enemy.body;
  if (enemy.kind === 'vez') {
    // Věž: podstavec a otočná hlaveň.
    ctx.fillStyle = herniPaleta.fialova;
    roundRect(ctx, b.x - 2, b.y + b.h * 0.45, b.w + 4, b.h * 0.55, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + b.h * 0.42, 7, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = paleta.noc;
    ctx.fillRect(b.x + b.w / 2 - 1.5, b.y + b.h * 0.2, 3, 8);
    return;
  }

  ctx.fillStyle = herniPaleta.limetka;
  roundRect(ctx, b.x, b.y, b.w, b.h, 4);
  ctx.fill();
  // Tři nožky, které se v chůzi vlní.
  ctx.strokeStyle = herniPaleta.limetka;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const lx = b.x + 3 + i * ((b.w - 6) / 2);
    ctx.moveTo(lx, b.y + b.h);
    ctx.lineTo(lx + Math.sin(phase * 0.25 + i) * 3, b.y + b.h + 4);
  }
  ctx.stroke();

  ctx.fillStyle = paleta.noc;
  ctx.beginPath();
  ctx.arc(b.x + b.w / 2 + enemy.dir * 3, b.y + b.h * 0.35, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawHero(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  facing: number, airborne: boolean, phase: number, hurt: boolean, color: string,
): void {
  ctx.save();
  ctx.globalAlpha = hurt && Math.floor(phase / 4) % 2 === 0 ? 0.4 : 1;

  ctx.fillStyle = color;
  roundRect(ctx, x, y + 5, w, h - 5, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w / 2, y + 5, 5.5, 0, Math.PI * 2);
  ctx.fill();

  // Zbraň vždycky ve směru pohledu.
  ctx.fillRect(facing > 0 ? x + w - 2 : x - 8, y + h * 0.42, 10, 4);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const swing = airborne ? 3 : Math.sin(phase * 0.3) * 4;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + h - 2);
  ctx.lineTo(x + 4 - swing, y + h + 3);
  ctx.moveTo(x + w - 4, y + h - 2);
  ctx.lineTo(x + w - 4 + swing, y + h + 3);
  ctx.stroke();
  ctx.restore();
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);

  const scale = height / WORLD_H;
  c.save();
  c.scale(scale, scale);

  const groundY = WORLD_H - TILE;
  for (let x = 0; x < width / scale + TILE; x += TILE) drawTileBlock(c, x, groundY, '#');

  const px = 40 + ((t * 60) % (width / scale));
  drawHero(c, px, groundY - 22, 16, 22, 1, false, t * 60, false, herniPaleta.cervena);
  c.fillStyle = herniPaleta.zluta;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.arc(px + 30 + ((t * 300 + i * 60) % 200), groundY - 13, 3, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const game: NajezdnikGame = createNajezdnik(ctx.seed);
  const recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode: ctx.mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let lastScore = 0;
  let lastHealth = game.state.health;
  let cameraX = 0;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    const won = game.state.won;
    ctx.audio.play(won ? 'win' : 'lose');
    const durationMs = game.state.ticks * (1000 / 60);
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score: game.state.score, durationMs,
      replay: recorder.finish(),
      stats: { uroven: game.state.level + 1 },
    });
    ctx.emit({
      type: won ? 'win' : 'gameover', score: game.state.score, durationMs,
      stats: { uroven: game.state.level + 1 },
    });
  };

  const draw = (): void => {
    const c = surface.ctx;
    const s = game.state;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    c.font = '500 14px system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText(`Úroveň ${s.level + 1}/${game.levels.length}`, 14, HEADER / 2 - 8);

    // Život srdíčky, náboje číslem.
    for (let i = 0; i < MAX_HEALTH; i++) {
      c.fillStyle = i < s.health ? herniPaleta.cervena : withAlpha(ctx.theme.text, 0.15);
      roundRect(c, 14 + i * 14, HEADER / 2 + 4, 10, 10, 2);
      c.fill();
    }

    c.textAlign = 'center';
    c.font = '600 20px system-ui, sans-serif';
    c.fillStyle = ctx.theme.text;
    c.fillText(String(s.score), VIEW_W / 2, HEADER / 2);

    c.textAlign = 'right';
    c.font = '500 14px system-ui, sans-serif';
    c.fillStyle = s.ammo > 5 ? herniPaleta.zluta : herniPaleta.cervena;
    c.fillText(`Náboje ${s.ammo}`, VIEW_W - 14, HEADER / 2);

    c.save();
    c.beginPath();
    c.rect(0, HEADER, VIEW_W, WORLD_H);
    c.clip();
    c.translate(-cameraX, HEADER);

    const from = Math.max(0, Math.floor(cameraX / TILE) - 1);
    const to = Math.min(s.width - 1, Math.ceil((cameraX + VIEW_W) / TILE));
    for (let ty = 0; ty < s.height; ty++) {
      for (let tx = from; tx <= to; tx++) drawTileBlock(c, tx * TILE, ty * TILE, s.rows[ty]![tx] ?? '.');
    }

    // Východ jako světelný obdélník.
    c.fillStyle = withAlpha(herniPaleta.zelena, 0.28);
    roundRect(c, s.exit.x + 2, s.exit.y - TILE + 2, TILE - 4, TILE * 2 - 4, 4);
    c.fill();
    c.strokeStyle = herniPaleta.zelena;
    c.lineWidth = 2;
    roundRect(c, s.exit.x + 2, s.exit.y - TILE + 2, TILE - 4, TILE * 2 - 4, 4);
    c.stroke();

    for (const pickup of s.pickups) {
      if (pickup.taken) continue;
      c.fillStyle = pickup.kind === 'lekarna' ? herniPaleta.cervena : herniPaleta.zluta;
      roundRect(c, pickup.x - 7, pickup.y - 6, 14, 12, 3);
      c.fill();
      c.fillStyle = paleta.noc;
      if (pickup.kind === 'lekarna') {
        c.fillRect(pickup.x - 4, pickup.y - 1.5, 8, 3);
        c.fillRect(pickup.x - 1.5, pickup.y - 4, 3, 8);
      } else {
        c.fillRect(pickup.x - 4, pickup.y - 2, 8, 4);
      }
    }

    for (const enemy of s.enemies) {
      if (!enemy.alive) continue;
      drawEnemy(c, enemy, s.ticks);
    }

    for (const shot of s.shots) {
      c.fillStyle = shot.fromPlayer ? herniPaleta.zluta : herniPaleta.limetka;
      c.beginPath();
      c.arc(shot.x, shot.y, 3, 0, Math.PI * 2);
      c.fill();
    }

    const p = s.player;
    drawHero(c, p.x, p.y, p.w, p.h, s.facing, !p.onGround, s.ticks, s.hurtTicks > 0, ctx.theme.accent);
    c.restore();

    if (s.levelDone) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.84);
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      centerText(c, 'Úroveň vyčištěna', VIEW_W / 2, VIEW_H / 2,
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

        const shotsBefore = game.state.shots.filter((s) => s.fromPlayer).length;
        game.step(mask);
        const shotsNow = game.state.shots.filter((s) => s.fromPlayer).length;
        if (shotsNow > shotsBefore) ctx.audio.play('move');

        if (game.state.health < lastHealth) ctx.audio.play('hit');
        lastHealth = game.state.health;

        const target = Math.max(
          0,
          Math.min(
            game.state.width * TILE - VIEW_W,
            game.state.player.x + game.state.player.w / 2 - VIEW_W / 2,
          ),
        );
        cameraX += (target - cameraX) * (ctx.theme.reducedMotion ? 1 : 0.18);

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
      surface.destroy();
    },
  };
}

export const module_: GameModule = {
  manifest, mount, renderAttract, keymap, touchButtons, controlHints,
};
