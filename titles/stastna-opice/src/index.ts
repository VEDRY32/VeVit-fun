/** Šťastná opice — klikací hlavolam ve čtyřech scénách. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, roundRect, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createStastnaOpice, SCENE_W, SCENE_H, MESSAGE_TICKS,
  type OpiceGame, type Backdrop, type Hotspot,
} from '@vevit-games/rules/stastna-opice';
import { manifest } from './manifest.js';

const VIEW_W = 640;
/** Hlavička, scéna a pod ní batoh — výška musí sednout na všechno tři. */
const SCENE_TOP = 40;
const BAG_H = 54;
const VIEW_H = SCENE_TOP + SCENE_H + BAG_H;
const BAG_Y = SCENE_TOP + SCENE_H + 6;

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  a: ['Space', 'Enter'],
};

export const controlHints = [
  { action: 'pointer', label: 'Prohlížet a používat', keys: 'klik / tap' },
  { action: 'left', label: 'Výběr místa', keys: '← →' },
  { action: 'a', label: 'Použít', keys: 'mezerník' },
];

/** Popisky předmětů; data pravidel drží jen jejich id. */
const ITEM_LABELS: Record<string, string> = {
  klacek: 'Klacek',
  banan: 'Banán',
  'susene-vetve': 'Suché větve',
  pazourek: 'Pazourek',
  hranice: 'Hranice',
  prkno: 'Prkno',
  liana: 'Liána',
  'vor-zaklad': 'Rozdělaný vor',
  sitka: 'Síťka',
  klic: 'Klíč',
};

const BACKDROP_COLORS: Record<Backdrop, [string, string]> = {
  les: ['#0E1A12', '#16301F'],
  jeskyne: ['#14121A', '#221C2E'],
  pobrezi: ['#0C1720', '#123043'],
  domek: ['#171310', '#2A1F18'],
};

/** Pozadí scény: pruhy a siluety, všechno kreslené, žádné obrázky. */
function drawBackdrop(ctx: CanvasRenderingContext2D, backdrop: Backdrop, phase: number): void {
  const [top, bottom] = BACKDROP_COLORS[backdrop];
  const gradient = ctx.createLinearGradient(0, 0, 0, SCENE_H);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);

  ctx.fillStyle = withAlpha('#ffffff', 0.05);
  if (backdrop === 'les') {
    for (let i = 0; i < 7; i++) {
      const x = 30 + i * 92;
      ctx.fillRect(x, 60, 14, SCENE_H - 60);
      ctx.beginPath();
      ctx.ellipse(x + 7, 60, 46, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (backdrop === 'jeskyne') {
    for (let i = 0; i < 9; i++) {
      const x = i * 74;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 26, 0);
      ctx.lineTo(x + 13, 50 + ((i * 37) % 40));
      ctx.closePath();
      ctx.fill();
    }
  } else if (backdrop === 'pobrezi') {
    for (let i = 0; i < 4; i++) {
      const y = SCENE_H - 90 + i * 22;
      ctx.beginPath();
      for (let x = 0; x <= SCENE_W; x += 8) {
        const wave = Math.sin(x * 0.03 + phase * 0.03 + i) * 4;
        if (x === 0) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.lineTo(SCENE_W, SCENE_H);
      ctx.lineTo(0, SCENE_H);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.fillRect(0, SCENE_H - 70, SCENE_W, 70);
    ctx.beginPath();
    ctx.moveTo(210, 180);
    ctx.lineTo(320, 110);
    ctx.lineTo(430, 180);
    ctx.closePath();
    ctx.fill();
  }
}

/** Opice: kruh s ušima a výrazem podle nálady. */
function drawMonkey(
  ctx: CanvasRenderingContext2D, x: number, y: number, size: number, mood: number, phase: number,
): void {
  const bob = Math.sin(phase * 0.06) * size * 0.03;
  ctx.fillStyle = herniPaleta.hneda;
  for (const dx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + dx * size * 0.62, y + bob, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y + bob, size * 0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = withAlpha('#ffffff', 0.85);
  ctx.beginPath();
  ctx.ellipse(x, y + bob + size * 0.16, size * 0.42, size * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = paleta.noc;
  for (const dx of [-0.24, 0.24]) {
    ctx.beginPath();
    ctx.arc(x + dx * size, y + bob - size * 0.12, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ústa: čím lepší nálada, tím širší úsměv.
  ctx.strokeStyle = paleta.noc;
  ctx.lineWidth = Math.max(2, size * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  const curve = (mood - 0.5) * size * 0.5;
  ctx.moveTo(x - size * 0.22, y + bob + size * 0.24);
  ctx.quadraticCurveTo(x, y + bob + size * 0.24 + curve, x + size * 0.22, y + bob + size * 0.24);
  ctx.stroke();
}

function drawHotspot(
  ctx: CanvasRenderingContext2D, spot: Hotspot, focused: boolean, accent: string, phase: number,
): void {
  const pulse = 0.35 + 0.25 * Math.abs(Math.sin(phase * 0.05));
  ctx.strokeStyle = withAlpha(accent, focused ? 0.95 : pulse);
  ctx.lineWidth = focused ? 3 : 2;
  ctx.setLineDash(focused ? [] : [6, 5]);
  roundRect(ctx, spot.x, spot.y, spot.w, spot.h, 8);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = withAlpha(accent, focused ? 0.18 : 0.07);
  roundRect(ctx, spot.x, spot.y, spot.w, spot.h, 8);
  ctx.fill();

  if (focused) {
    centerText(ctx, spot.label, spot.x + spot.w / 2, spot.y - 12,
      '600 13px system-ui, sans-serif', accent);
  }
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  const scale = Math.max(width / SCENE_W, height / SCENE_H);
  c.save();
  c.scale(scale, scale);
  drawBackdrop(c, 'les', t * 60);
  drawMonkey(c, SCENE_W / 2, SCENE_H / 2, 70, 0.5 + Math.sin(t) * 0.4, t * 60);
  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const game: OpiceGame = createStastnaOpice(ctx.seed);
  let finished = false;
  let lastScore = 0;
  let lastScene = game.state.scene;
  /** Místo vybrané klávesnicí; myš ho jen zvýrazňuje. */
  let focus = 0;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('win');
    const durationMs = game.state.ticks * (1000 / 60);
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score: game.state.score, durationMs,
      stats: { sceny: game.scenes.length },
    });
    ctx.emit({
      type: 'win', score: game.state.score, durationMs,
      stats: { sceny: game.scenes.length },
    });
  };

  const draw = (): void => {
    const c = surface.ctx;
    const s = game.state;
    const scene = game.scenes[s.scene]!;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    // Hlavička
    c.font = '500 13px system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText(`Scéna ${s.scene + 1}/${game.scenes.length} · ${scene.name}`, 12, SCENE_TOP / 2);
    c.textAlign = 'right';
    c.fillStyle = ctx.theme.text;
    c.font = '600 18px system-ui, sans-serif';
    c.fillText(String(s.score), VIEW_W - 12, SCENE_TOP / 2);

    c.save();
    c.translate(0, SCENE_TOP);
    drawBackdrop(c, scene.backdrop, s.ticks);

    const spots = game.spots();
    spots.forEach((spot, i) => {
      drawHotspot(c, spot, i === focus % Math.max(1, spots.length), ctx.theme.accent, s.ticks);
    });

    drawMonkey(c, 305, 300, 56, s.mood, s.ticks);

    if (s.messageTicks > 0) {
      const fade = Math.min(1, s.messageTicks / 30);
      c.globalAlpha = fade;
      c.fillStyle = withAlpha(paleta.noc, 0.82);
      roundRect(c, 40, 16, SCENE_W - 80, 40, 10);
      c.fill();
      centerText(c, s.message, SCENE_W / 2, 36, '500 15px system-ui, sans-serif', paleta.text);
      c.globalAlpha = 1;
    }
    c.restore();

    // Batoh
    c.fillStyle = withAlpha(ctx.theme.text, 0.05);
    roundRect(c, 12, BAG_Y, VIEW_W - 24, BAG_H - 12, 8);
    c.fill();
    c.textAlign = 'left';
    c.font = '500 12px system-ui, sans-serif';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText('Batoh', 22, BAG_Y + 21);
    if (s.inventory.length === 0) {
      c.fillStyle = withAlpha(ctx.theme.text, 0.3);
      c.fillText('zatím prázdný', 76, BAG_Y + 21);
    }
    s.inventory.forEach((item, i) => {
      const x = 76 + i * 108;
      const held = s.held === item;
      c.fillStyle = held ? withAlpha(ctx.theme.accent, 0.22) : withAlpha(ctx.theme.text, 0.07);
      roundRect(c, x, BAG_Y + 9, 100, 24, 6);
      c.fill();
      c.fillStyle = held ? ctx.theme.accent : ctx.theme.text;
      c.font = '500 12px system-ui, sans-serif';
      c.fillText(ITEM_LABELS[item] ?? item, x + 10, BAG_Y + 21);
    });

    if (s.won) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.88);
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      centerText(c, 'Opice je šťastná!', VIEW_W / 2, VIEW_H / 2 - 10,
        '600 28px system-ui, sans-serif', ctx.theme.accent);
      centerText(c, `${s.score} bodů`, VIEW_W / 2, VIEW_H / 2 + 24,
        '500 16px system-ui, sans-serif', ctx.theme.textMuted);
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (game.state.won) return;
    const local = surface.toLogical(e.clientX, e.clientY);

    // Klik do batohu vezme předmět do ruky.
    if (local.y >= BAG_Y) {
      game.state.inventory.forEach((item, i) => {
        const x = 76 + i * 108;
        if (local.x >= x && local.x <= x + 100) {
          game.hold(game.state.held === item ? null : item);
          ctx.audio.play('tick');
        }
      });
      return;
    }

    const sceneY = local.y - SCENE_TOP;
    for (const spot of game.spots()) {
      if (local.x < spot.x || local.x > spot.x + spot.w) continue;
      if (sceneY < spot.y || sceneY > spot.y + spot.h) continue;
      ctx.audio.play(game.click(spot.id) ? 'pickup' : 'error');
      return;
    }
    ctx.audio.play('tick');
    game.click('mimo');
  };
  surface.canvas.addEventListener('pointerup', onPointerUp);

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();

        // Klávesnicová alternativa: šipky vybírají místo, mezerník použije.
        const spots = game.spots();
        if (spots.length > 0) {
          if (input.pressed('right')) focus = (focus + 1) % spots.length;
          if (input.pressed('left')) focus = (focus - 1 + spots.length) % spots.length;
          if (input.pressed('a')) {
            const spot = spots[focus % spots.length];
            if (spot) ctx.audio.play(game.click(spot.id) ? 'pickup' : 'error');
          }
        }

        game.step();

        if (game.state.score !== lastScore) {
          lastScore = game.state.score;
          ctx.emit({ type: 'score', value: lastScore });
        }
        if (game.state.scene !== lastScene) {
          lastScene = game.state.scene;
          focus = 0;
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
  void MESSAGE_TICKS;

  return {
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    destroy() {
      loop.stop();
      surface.canvas.removeEventListener('pointerup', onPointerUp);
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, controlHints };
