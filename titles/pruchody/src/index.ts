/** Průchody — hlavolam s hybností a dvojicí průchodů. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, roundRect, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createPruchody, TILE, BALL_R, type PruchodyGame, type Portal, type Side,
} from '@vevit-games/rules/pruchody';
import { manifest } from './manifest.js';

const HEADER = 48;
const VIEW_W = 640;
const VIEW_H = 288;

const PORTAL_COLORS = [herniPaleta.oranzova, herniPaleta.modra] as const;

export { manifest };

export const keymap: Partial<Keymap> = {
  a: ['Space'],
  b: ['KeyR'],
};

export const controlHints = [
  { action: 'pointer', label: 'Levý klik oranžový, pravý modrý', keys: 'myš' },
  { action: 'a', label: 'Pustit kuličku', keys: 'mezerník' },
];

/** Ústí průchodu jako oblouk na hraně dlaždice. */
function drawPortal(ctx: CanvasRenderingContext2D, portal: Portal, color: string, phase: number): void {
  const cx = portal.tx * TILE + TILE / 2;
  const cy = portal.ty * TILE + TILE / 2;
  const angle: Record<Side, number> = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle[portal.side]);

  const pulse = 1 + Math.sin(phase * 0.08) * 0.06;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(TILE / 2, 0, 5, (TILE / 2 - 3) * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = withAlpha(color, 0.3);
  ctx.beginPath();
  ctx.ellipse(TILE / 2, 0, 4, (TILE / 2 - 4) * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, game: PruchodyGame, phase: number, accent: string): void {
  const s = game.state;
  for (let ty = 0; ty < s.height; ty++) {
    for (let tx = 0; tx < s.width; tx++) {
      const char = game.charAt(tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      if (char === '#') {
        ctx.fillStyle = herniPaleta.kamen;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = withAlpha('#ffffff', 0.06);
        ctx.fillRect(x, y, TILE, 2);
      } else if (char === 'x') {
        // Kov: šrafování, aby bylo poznat, že na něj průchod nejde.
        ctx.fillStyle = herniPaleta.kamenTmavy;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = withAlpha('#ffffff', 0.12);
        ctx.lineWidth = 2;
        for (let i = -TILE; i < TILE; i += 8) {
          ctx.beginPath();
          ctx.moveTo(x + i, y + TILE);
          ctx.lineTo(x + i + TILE, y);
          ctx.stroke();
        }
      } else if (char === '^') {
        ctx.fillStyle = herniPaleta.cervena;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * (TILE / 4), y + TILE);
          ctx.lineTo(x + (i + 0.5) * (TILE / 4), y + TILE * 0.45);
          ctx.lineTo(x + (i + 1) * (TILE / 4), y + TILE);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  // Cíl je prstenec, který dýchá.
  const ring = TILE * 0.34 + Math.sin(phase * 0.06) * 2;
  ctx.strokeStyle = herniPaleta.zelena;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(s.goal.x, s.goal.y, ring, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = withAlpha(herniPaleta.zelena, 0.2);
  ctx.fill();

  s.portals.forEach((portal, i) => {
    if (portal) drawPortal(ctx, portal, PORTAL_COLORS[i]!, phase);
  });

  // Kulička; dokud stojí, má kolem sebe naznačený start.
  if (!s.released) {
    ctx.strokeStyle = withAlpha(accent, 0.4);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.start.x, s.start.y, BALL_R + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = withAlpha('#ffffff', 0.35);
  ctx.beginPath();
  ctx.arc(s.ball.x - 2.5, s.ball.y - 2.5, BALL_R * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);

  const game = createPruchody('ukazka');
  game.place(0, TILE * 3 + TILE / 2, (game.state.height - 1) * TILE + 2);
  game.place(1, TILE - 2, TILE * 2 + TILE / 2);
  game.release();
  for (let i = 0; i < Math.floor((t * 60) % 240); i++) game.step();

  const scale = Math.min(width / (game.state.width * TILE), height / (game.state.height * TILE));
  c.save();
  c.translate(
    (width - game.state.width * TILE * scale) / 2,
    (height - game.state.height * TILE * scale) / 2,
  );
  c.scale(scale, scale);
  drawWorld(c, game, t * 60, herniPaleta.zluta);
  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const game: PruchodyGame = createPruchody(ctx.seed);
  let finished = false;
  let lastScore = 0;
  let lastLevel = game.state.level;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('win');
    const durationMs = game.state.ticks * (1000 / 60);
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score: game.state.score, durationMs,
      stats: { urovne: game.levels.length },
    });
    ctx.emit({
      type: 'win', score: game.state.score, durationMs,
      stats: { urovne: game.levels.length },
    });
  };

  const offset = (): { x: number; y: number } => ({
    x: (VIEW_W - game.state.width * TILE) / 2,
    y: HEADER + (VIEW_H - HEADER - game.state.height * TILE) / 2,
  });

  const draw = (): void => {
    const c = surface.ctx;
    const s = game.state;
    const level = game.levels[s.level]!;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    c.font = '500 13px system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText(`Úroveň ${s.level + 1}/${game.levels.length} · ${level.name}`, 12, 16);
    c.fillText(level.hint, 12, 34);
    c.textAlign = 'right';
    c.fillStyle = ctx.theme.text;
    c.font = '600 18px system-ui, sans-serif';
    c.fillText(String(s.score), VIEW_W - 12, 20);
    c.font = '500 12px system-ui, sans-serif';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText(`Pokusů ${s.attempts}`, VIEW_W - 12, 38);

    const { x, y } = offset();
    c.save();
    c.translate(x, y);
    drawWorld(c, game, s.ticks, ctx.theme.accent);
    c.restore();

    if (s.levelDone) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.84);
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      centerText(c, 'Kulička v cíli!', VIEW_W / 2, VIEW_H / 2,
        '600 24px system-ui, sans-serif', ctx.theme.accent);
    }
    if (s.won) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.9);
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      centerText(c, 'Všechny úrovně hotové', VIEW_W / 2, VIEW_H / 2,
        '600 24px system-ui, sans-serif', ctx.theme.accent);
    }
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (game.state.won) return;
    const local = surface.toLogical(e.clientX, e.clientY);
    const { x, y } = offset();
    // Pravé tlačítko nebo dlouhý tap pokládá druhý průchod.
    const index = e.button === 2 ? 1 : 0;
    const placed = game.place(index, local.x - x, local.y - y);
    ctx.audio.play(placed ? 'click' : 'error');
  };
  const onContextMenu = (e: Event): void => e.preventDefault();
  surface.canvas.addEventListener('pointerdown', onPointerDown);
  surface.canvas.addEventListener('contextmenu', onContextMenu);

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();
        if (input.pressed('a')) {
          game.release();
          ctx.audio.play('move');
        }
        if (input.pressed('b')) game.reset();

        game.step();

        if (game.state.score !== lastScore) {
          lastScore = game.state.score;
          ctx.emit({ type: 'score', value: lastScore });
        }
        if (game.state.level !== lastLevel) {
          lastLevel = game.state.level;
          ctx.audio.play('levelUp');
        }
        if (game.state.won) finish();
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
      surface.canvas.removeEventListener('pointerdown', onPointerDown);
      surface.canvas.removeEventListener('contextmenu', onContextMenu);
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, controlHints };
