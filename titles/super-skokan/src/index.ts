/** Super skokan — plošinovka s posouvající se kamerou. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createReplayRecorder, roundRect, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createSuperSkokan, TILE, LEVEL_TICKS, LEVELS,
  type SkokanGame, type Enemy,
} from '@vevit-games/rules/super-skokan';
import { manifest } from './manifest.js';

const HEADER = 60;
const VIEW_W = 640;
const VIEW_H = 300;
const WORLD_H = VIEW_H - HEADER;

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  a: ['Space', 'ArrowUp', 'KeyW'],
};

export const touchButtons = [
  { action: 'left', label: '←', x: 12, y: 80 },
  { action: 'right', label: '→', x: 32, y: 80 },
  { action: 'a', label: '⤒', x: 86, y: 80, size: 15 },
];

export const controlHints = [
  { action: 'left', label: 'Pohyb', keys: '← →' },
  { action: 'a', label: 'Skok (držením výš)', keys: 'mezerník' },
];

function drawTileBlock(ctx: CanvasRenderingContext2D, x: number, y: number, char: string): void {
  if (char === '#') {
    ctx.fillStyle = herniPaleta.kamen;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = withAlpha('#ffffff', 0.08);
    ctx.fillRect(x, y, TILE, 3);
    return;
  }
  if (char === '=') {
    ctx.fillStyle = herniPaleta.hneda;
    roundRect(ctx, x, y + 2, TILE, TILE - 8, 3);
    ctx.fill();
    ctx.fillStyle = withAlpha('#ffffff', 0.14);
    ctx.fillRect(x, y + 2, TILE, 2);
    return;
  }
  if (char === '^') {
    ctx.fillStyle = herniPaleta.cervena;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * (TILE / 3), y + TILE);
      ctx.lineTo(x + (i + 0.5) * (TILE / 3), y + TILE * 0.35);
      ctx.lineTo(x + (i + 1) * (TILE / 3), y + TILE);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number, phase: number): void {
  const color = enemy.kind === 'chodec' ? herniPaleta.fialova : herniPaleta.tyrkys;
  const w = enemy.body.w;
  const h = enemy.body.h;
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, enemy.kind === 'chodec' ? 5 : 9);
  ctx.fill();

  // Nožky se u chodce střídají, skokan má jednu pružinu.
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (enemy.kind === 'chodec') {
    const swing = Math.sin(phase * 0.2) * 3;
    ctx.moveTo(x + 4, y + h);
    ctx.lineTo(x + 4 - swing, y + h + 4);
    ctx.moveTo(x + w - 4, y + h);
    ctx.lineTo(x + w - 4 + swing, y + h + 4);
  } else {
    ctx.moveTo(x + w / 2, y + h);
    ctx.lineTo(x + w / 2, y + h + 4);
  }
  ctx.stroke();

  ctx.fillStyle = paleta.noc;
  for (const dx of [0.32, 0.68]) {
    ctx.beginPath();
    ctx.arc(x + w * dx, y + h * 0.35, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  facing: number, running: boolean, airborne: boolean, phase: number, color: string,
): void {
  ctx.fillStyle = color;
  roundRect(ctx, x, y + 4, w, h - 4, 5);
  ctx.fill();

  // Hlava s čepicí — vlastní postavička, žádná cizí předloha.
  ctx.beginPath();
  ctx.arc(x + w / 2, y + 5, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = withAlpha('#ffffff', 0.2);
  ctx.fillRect(x + w / 2 - 7, y, 14 * (facing > 0 ? 1 : 1), 3);

  ctx.fillStyle = paleta.noc;
  ctx.beginPath();
  ctx.arc(x + w / 2 + facing * 2.5, y + 4, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const swing = airborne ? 3 : running ? Math.sin(phase * 0.35) * 4 : 0;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + h - 2);
  ctx.lineTo(x + 4 - swing, y + h + 3);
  ctx.moveTo(x + w - 4, y + h - 2);
  ctx.lineTo(x + w - 4 + swing, y + h + 3);
  ctx.stroke();
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
  for (let x = 0; x < width / scale + TILE; x += TILE) {
    drawTileBlock(c, x, groundY, '#');
  }
  for (let i = 0; i < 3; i++) {
    drawTileBlock(c, 60 + i * TILE, groundY - TILE * 3, '=');
  }

  // Postavička poskakuje přes plošinu dokola.
  const cycle = (t * 0.6) % 1;
  const px = 30 + cycle * (width / scale - 80);
  const jump = Math.sin(cycle * Math.PI * 4);
  const py = groundY - 22 - Math.max(0, jump) * 40;
  drawPlayer(c, px, py, 16, 22, 1, true, jump > 0, t * 60, herniPaleta.oranzova);
  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const game: SkokanGame = createSuperSkokan(ctx.seed);
  const recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode: ctx.mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let lastScore = 0;
  let lastLives = game.state.lives;
  let lastLevel = game.state.level;
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
      type: won ? 'win' : 'gameover',
      score: game.state.score, durationMs,
      stats: { uroven: game.state.level + 1 },
    });
  };

  const draw = (): void => {
    const c = surface.ctx;
    const s = game.state;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    // Hlavička
    c.font = '500 14px system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText(`Úroveň ${s.level + 1}/${LEVELS.length} · ${LEVELS[s.level]?.name ?? ''}`, 14, HEADER / 2 - 8);
    const seconds = Math.max(0, Math.ceil((LEVEL_TICKS - s.ticks) / 60));
    c.fillText(`Čas ${seconds} s`, 14, HEADER / 2 + 12);

    c.textAlign = 'center';
    c.font = '600 20px system-ui, sans-serif';
    c.fillStyle = ctx.theme.text;
    c.fillText(String(s.score), VIEW_W / 2, HEADER / 2);

    c.textAlign = 'right';
    c.font = '500 14px system-ui, sans-serif';
    c.fillStyle = herniPaleta.cervena;
    c.fillText('♥'.repeat(Math.max(0, s.lives)), VIEW_W - 14, HEADER / 2);

    c.save();
    c.beginPath();
    c.rect(0, HEADER, VIEW_W, WORLD_H);
    c.clip();
    c.translate(-cameraX, HEADER);

    const fromTile = Math.max(0, Math.floor(cameraX / TILE) - 1);
    const toTile = Math.min(s.width - 1, Math.ceil((cameraX + VIEW_W) / TILE));
    for (let ty = 0; ty < s.height; ty++) {
      for (let tx = fromTile; tx <= toTile; tx++) {
        drawTileBlock(c, tx * TILE, ty * TILE, s.rows[ty]![tx] ?? '.');
      }
    }

    // Vlajka v cíli.
    c.fillStyle = herniPaleta.zelena;
    c.fillRect(s.goal.x + TILE / 2 - 2, s.goal.y - TILE, 3, TILE * 2);
    c.beginPath();
    c.moveTo(s.goal.x + TILE / 2 + 1, s.goal.y - TILE);
    c.lineTo(s.goal.x + TILE / 2 + 16, s.goal.y - TILE + 7);
    c.lineTo(s.goal.x + TILE / 2 + 1, s.goal.y - TILE + 14);
    c.closePath();
    c.fill();

    const phase = s.ticks;
    for (const coin of s.coins) {
      if (coin.taken) continue;
      // Fáze otáčení se odvíjí od polohy mince, aby se všechny netočily
      // naráz — jinak v jednom snímku zmizí celá řada do svislých čárek.
      const wobble = ctx.theme.reducedMotion
        ? 1
        : 0.45 + 0.55 * Math.abs(Math.cos(phase * 0.07 + coin.x * 0.21));
      c.fillStyle = herniPaleta.zluta;
      c.beginPath();
      c.ellipse(coin.x, coin.y, 6 * wobble, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = withAlpha(paleta.noc, 0.35);
      c.beginPath();
      c.ellipse(coin.x, coin.y, 2.6 * wobble, 2.6, 0, 0, Math.PI * 2);
      c.fill();
    }

    for (const enemy of s.enemies) {
      if (!enemy.alive) continue;
      drawEnemy(c, enemy, enemy.body.x, enemy.body.y, phase);
    }

    const p = s.player;
    const blink = s.respawnTimer > 0 && Math.floor(phase / 5) % 2 === 0;
    if (!blink) {
      drawPlayer(
        c, p.x, p.y, p.w, p.h, s.facing,
        Math.abs(p.vx) > 0.5, !p.onGround, phase, ctx.theme.accent,
      );
    }
    c.restore();

    if (s.levelDone) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.82);
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      centerText(c, 'Úroveň hotová', VIEW_W / 2, VIEW_H / 2,
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

        const wasGround = game.state.player.onGround;
        game.step(mask);
        if (wasGround && !game.state.player.onGround && game.state.player.vy < 0) {
          ctx.audio.play('move');
        }

        // Kamera dojíždí k hráči, aby se obraz netrhal.
        const target = Math.max(
          0,
          Math.min(
            game.state.width * TILE - VIEW_W,
            game.state.player.x + game.state.player.w / 2 - VIEW_W / 2,
          ),
        );
        cameraX += (target - cameraX) * (ctx.theme.reducedMotion ? 1 : 0.18);

        if (game.state.score !== lastScore) {
          ctx.audio.play('pickup');
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
