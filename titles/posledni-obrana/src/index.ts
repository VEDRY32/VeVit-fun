/** Poslední obrana — vlny nepřátel proti barikádě, míří se myší. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createReplayRecorder, roundRect, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createPosledniObrana, WORLD_W, WORLD_H, TURRET_X, TURRET_Y, BARRICADE_Y, BARRICADE_W,
  type ObranaGame, type Enemy,
} from '@vevit-games/rules/posledni-obrana';
import { manifest } from './manifest.js';

export { manifest };

export const keymap: Partial<Keymap> = {
  a: ['Space'],
  b: ['KeyR'],
  left: ['Digit1', 'ArrowLeft'],
  up: ['Digit2', 'ArrowUp'],
  right: ['Digit3', 'ArrowRight'],
};

export const touchButtons = [
  { action: 'a', label: '◎', x: 88, y: 84, size: 16 },
  { action: 'b', label: 'R', x: 88, y: 60 },
];

export const controlHints = [
  { action: 'pointer', label: 'Míření a střelba', keys: 'myš / prst' },
  { action: 'b', label: 'Nabít', keys: 'R' },
  { action: 'left', label: 'Vylepšení mezi vlnami', keys: '1 2 3' },
];

const KIND_COLOR: Record<Enemy['kind'], string> = {
  bezec: herniPaleta.cervena,
  tezky: herniPaleta.fialova,
  plivac: herniPaleta.limetka,
};

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, phase: number): void {
  const r = enemy.kind === 'tezky' ? 15 : enemy.kind === 'plivac' ? 12 : 10;
  const wobble = Math.sin(phase * 0.14 + enemy.x * 0.05) * 1.6;

  ctx.fillStyle = KIND_COLOR[enemy.kind];
  ctx.beginPath();
  if (enemy.kind === 'tezky') {
    // Těžký je hranatý kolos, běžec kapka, plivač placka s čelistí.
    roundRect(ctx, enemy.x - r, enemy.y - r, r * 2, r * 2, 5);
  } else if (enemy.kind === 'plivac') {
    ctx.ellipse(enemy.x, enemy.y, r * 1.2, r * 0.8, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(enemy.x, enemy.y + wobble, r * 0.85, r, 0, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.fillStyle = paleta.noc;
  for (const dx of [-0.36, 0.36]) {
    ctx.beginPath();
    ctx.arc(enemy.x + dx * r, enemy.y - r * 0.15, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Proužek zdraví jen u poškozených, ať je pole čisté.
  if (enemy.hp < enemy.maxHp) {
    ctx.fillStyle = withAlpha(paleta.noc, 0.6);
    ctx.fillRect(enemy.x - r, enemy.y - r - 8, r * 2, 4);
    ctx.fillStyle = herniPaleta.zelena;
    ctx.fillRect(enemy.x - r, enemy.y - r - 8, r * 2 * (enemy.hp / enemy.maxHp), 4);
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

  c.fillStyle = herniPaleta.kamen;
  roundRect(c, TURRET_X - BARRICADE_W / 2, BARRICADE_Y, BARRICADE_W, 26, 5);
  c.fill();

  for (let i = 0; i < 5; i++) {
    drawEnemy(c, {
      kind: i % 3 === 0 ? 'tezky' : 'bezec',
      x: 120 + i * 120,
      y: 120 + Math.sin(t + i) * 40,
      hp: 2, maxHp: 2, speed: 1, cooldown: 0,
    }, t * 60);
  }

  const aim = -Math.PI / 2 + Math.sin(t * 0.9) * 0.7;
  c.strokeStyle = herniPaleta.zluta;
  c.lineWidth = 7;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(TURRET_X, TURRET_Y);
  c.lineTo(TURRET_X + Math.cos(aim) * 34, TURRET_Y + Math.sin(aim) * 34);
  c.stroke();
  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: WORLD_W, logicalHeight: WORLD_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const game: ObranaGame = createPosledniObrana(ctx.seed);
  const recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode: ctx.mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let lastScore = 0;
  let lastAmmo = game.state.ammo;
  let lastBarricade = game.state.barricade;
  /** Úhel hlavně; myš ho přepisuje, klávesnice jím otáčí. */
  let aim = -Math.PI / 2;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('lose');
    const durationMs = game.state.tick * (1000 / 60);
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score: game.state.score, durationMs,
      replay: recorder.finish(),
      stats: { vlna: game.state.wave },
    });
    ctx.emit({
      type: 'gameover', score: game.state.score, durationMs,
      stats: { vlna: game.state.wave },
    });
  };

  const offerBoxes = (): { x: number; y: number; w: number; h: number }[] => {
    const w = 190;
    const gap = 20;
    const total = w * 3 + gap * 2;
    return [0, 1, 2].map((i) => ({
      x: (WORLD_W - total) / 2 + i * (w + gap),
      y: WORLD_H / 2 - 40,
      w, h: 92,
    }));
  };

  const draw = (): void => {
    const c = surface.ctx;
    const s = game.state;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, WORLD_W, WORLD_H);

    // Zem za barikádou, aby bylo poznat, co se brání.
    c.fillStyle = withAlpha(ctx.theme.text, 0.04);
    c.fillRect(0, BARRICADE_Y, WORLD_W, WORLD_H - BARRICADE_Y);

    for (const enemy of s.enemies) drawEnemy(c, enemy, s.tick);

    for (const shot of s.shots) {
      c.fillStyle = shot.fromPlayer ? herniPaleta.zluta : herniPaleta.limetka;
      c.beginPath();
      c.arc(shot.x, shot.y, shot.fromPlayer ? 3.5 : 5, 0, Math.PI * 2);
      c.fill();
    }

    // Barikáda: šířka podle zbývajícího života.
    const ratio = s.barricade / s.maxBarricade;
    c.fillStyle = withAlpha(herniPaleta.kamen, 0.4);
    roundRect(c, TURRET_X - BARRICADE_W / 2, BARRICADE_Y, BARRICADE_W, 26, 5);
    c.fill();
    c.fillStyle = ratio > 0.35 ? herniPaleta.kamen : herniPaleta.cervena;
    roundRect(c, TURRET_X - BARRICADE_W / 2, BARRICADE_Y, BARRICADE_W * ratio, 26, 5);
    c.fill();

    // Hlaveň a střelec. Vlastní barva, ne barva kategorie — ta je u akčních
    // her červená a střelec by splynul s nepřáteli.
    c.strokeStyle = paleta.zelena;
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(TURRET_X, TURRET_Y);
    c.lineTo(TURRET_X + Math.cos(s.aim) * 32, TURRET_Y + Math.sin(s.aim) * 32);
    c.stroke();
    c.fillStyle = paleta.zelena;
    c.beginPath();
    c.arc(TURRET_X, TURRET_Y, 11, 0, Math.PI * 2);
    c.fill();

    // HUD
    c.font = '500 14px system-ui, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText(`Vlna ${s.wave}`, 16, 14);
    c.fillText(`Barikáda ${Math.ceil(s.barricade)}`, 16, 34);

    c.textAlign = 'right';
    c.font = '600 22px system-ui, sans-serif';
    c.fillStyle = ctx.theme.text;
    c.fillText(String(s.score), WORLD_W - 16, 12);

    // Zásobník: tečky, při nabíjení ubývající pruh.
    c.textAlign = 'right';
    c.font = '500 13px system-ui, sans-serif';
    if (s.reloadTimer > 0) {
      c.fillStyle = herniPaleta.oranzova;
      c.fillText('Nabíjím…', WORLD_W - 16, 44);
    } else {
      for (let i = 0; i < s.magazine; i++) {
        c.fillStyle = i < s.ammo ? herniPaleta.zluta : withAlpha(ctx.theme.text, 0.15);
        c.fillRect(WORLD_W - 16 - (i + 1) * 8, 46, 5, 12);
      }
    }

    if (s.offers.length > 0) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.88);
      c.fillRect(0, 0, WORLD_W, WORLD_H);
      centerText(c, `Vlna ${s.wave} ubráněna`, WORLD_W / 2, WORLD_H / 2 - 90,
        '600 26px system-ui, sans-serif', ctx.theme.accent);
      centerText(c, 'Vyber si vylepšení', WORLD_W / 2, WORLD_H / 2 - 60,
        '500 15px system-ui, sans-serif', ctx.theme.textMuted);

      offerBoxes().forEach((box, i) => {
        c.fillStyle = withAlpha(ctx.theme.text, 0.06);
        roundRect(c, box.x, box.y, box.w, box.h, 10);
        c.fill();
        c.strokeStyle = withAlpha(ctx.theme.accent, 0.5);
        c.lineWidth = 2;
        roundRect(c, box.x, box.y, box.w, box.h, 10);
        c.stroke();
        centerText(c, String(i + 1), box.x + box.w / 2, box.y + 26,
          '600 18px system-ui, sans-serif', ctx.theme.accent);
        centerText(c, s.offers[i]?.label ?? '', box.x + box.w / 2, box.y + 62,
          '500 15px system-ui, sans-serif', ctx.theme.text);
      });
    }
  };

  /** Myš míří; klik na nabídku mezi vlnami vybírá vylepšení. */
  const onPointerMove = (e: PointerEvent): void => {
    const local = surface.toLogical(e.clientX, e.clientY);
    aim = Math.atan2(local.y - TURRET_Y, local.x - TURRET_X);
  };
  const onPointerDown = (e: PointerEvent): void => {
    if (game.state.offers.length === 0) return;
    const local = surface.toLogical(e.clientX, e.clientY);
    offerBoxes().forEach((box, i) => {
      if (local.x >= box.x && local.x <= box.x + box.w
        && local.y >= box.y && local.y <= box.y + box.h) {
        if (game.choose(i)) ctx.audio.play('levelUp');
      }
    });
  };
  surface.canvas.addEventListener('pointermove', onPointerMove);
  surface.canvas.addEventListener('pointerdown', onPointerDown);

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();
        const mask = input.snapshot();
        recorder.record(mask);

        // Klávesnicová alternativa míření, aby hra šla i bez myši.
        if (game.state.offers.length === 0) {
          if (input.held('left')) aim -= 0.045;
          if (input.held('right')) aim += 0.045;
          aim = Math.max(-Math.PI + 0.2, Math.min(-0.2, aim));
        }

        const ammoBefore = game.state.ammo;
        game.step(mask, aim);
        if (game.state.ammo < ammoBefore) ctx.audio.play('move');
        if (game.state.ammo > lastAmmo) ctx.audio.play('click');
        lastAmmo = game.state.ammo;

        if (game.state.barricade < lastBarricade) ctx.audio.play('hit');
        lastBarricade = game.state.barricade;

        if (game.state.score !== lastScore) {
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
      surface.canvas.removeEventListener('pointermove', onPointerMove);
      surface.canvas.removeEventListener('pointerdown', onPointerDown);
      surface.destroy();
    },
  };
}

export const module_: GameModule = {
  manifest, mount, renderAttract, keymap, touchButtons, controlHints,
};
