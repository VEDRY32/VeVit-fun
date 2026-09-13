/** Pouliční bitka — mlátička z boku s hloubkou ulice. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createReplayRecorder, roundRect, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createPoulicniBitka, WORLD_W, WORLD_H, STREET_TOP, STREET_BOTTOM,
  FIGHTER_W, FIGHTER_H, type BitkaGame, type Fighter, type Enemy,
} from '@vevit-games/rules/poulicni-bitka';
import { manifest } from './manifest.js';

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  a: ['Space', 'KeyJ'],
  b: ['KeyK'],
};

export const touchButtons = [
  { action: 'left', label: '←', x: 10, y: 82 },
  { action: 'right', label: '→', x: 28, y: 82 },
  { action: 'up', label: '↑', x: 19, y: 62 },
  { action: 'down', label: '↓', x: 19, y: 96 },
  { action: 'a', label: '✊', x: 84, y: 82, size: 15 },
  { action: 'b', label: '🦵', x: 95, y: 62 },
];

export const controlHints = [
  { action: 'left', label: 'Pohyb po ulici i do hloubky', keys: '← ↑ → ↓' },
  { action: 'a', label: 'Pěst', keys: 'mezerník' },
  { action: 'b', label: 'Kop', keys: 'K' },
];

/** Postava: silueta s hlavou, rukou v úderu a stínem na zemi. */
function drawFighter(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter, color: string, phase: number,
  attackBox: { x: number; y: number; w: number; h: number } | null,
): void {
  const x = fighter.x;
  const y = fighter.y;
  const top = y - FIGHTER_H;

  // Stín říká, kde postava v hloubce opravdu stojí.
  ctx.fillStyle = withAlpha(paleta.noc, 0.5);
  ctx.beginPath();
  ctx.ellipse(x + FIGHTER_W / 2, y, FIGHTER_W * 0.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = fighter.hurtTicks > 0 && Math.floor(phase / 3) % 2 === 0 ? 0.45 : 1;

  ctx.fillStyle = color;
  roundRect(ctx, x + 4, top + 18, FIGHTER_W - 8, FIGHTER_H - 18, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + FIGHTER_W / 2, top + 9, 9, 0, Math.PI * 2);
  ctx.fill();

  // Nohy v mírném rozkroku.
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 9, y - 12);
  ctx.lineTo(x + 6, y - 1);
  ctx.moveTo(x + FIGHTER_W - 9, y - 12);
  ctx.lineTo(x + FIGHTER_W - 6, y - 1);
  ctx.stroke();

  if (attackBox) {
    // Ruka nebo noha v úderu; box je zároveň dosah zásahu.
    ctx.lineWidth = fighter.attack === 'kop' ? 7 : 5;
    ctx.beginPath();
    ctx.moveTo(x + FIGHTER_W / 2, top + (fighter.attack === 'kop' ? 34 : 22));
    ctx.lineTo(
      fighter.facing > 0 ? attackBox.x + attackBox.w : attackBox.x,
      top + (fighter.attack === 'kop' ? 38 : 22),
    );
    ctx.stroke();
  }

  ctx.fillStyle = paleta.noc;
  ctx.beginPath();
  ctx.arc(x + FIGHTER_W / 2 + fighter.facing * 3, top + 8, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Pozadí: fasáda nahoře, chodník a vozovka dole. */
function drawStreet(ctx: CanvasRenderingContext2D, phase: number, muted: string): void {
  ctx.fillStyle = herniPaleta.kamenTmavy;
  ctx.fillRect(0, 0, WORLD_W, STREET_TOP - 20);

  // Okna v pravidelném rastru, ať je poznat, že jde o dům.
  for (let x = 20; x < WORLD_W - 20; x += 60) {
    for (let y = 30; y < STREET_TOP - 60; y += 56) {
      // Střídání oken je dané pozicí, ne náhodou — fasáda tak neposkakuje.
      const lit = ((x * 31 + y * 17) % 7) < 2;
      ctx.fillStyle = lit ? withAlpha(herniPaleta.zluta, 0.35) : withAlpha('#ffffff', 0.05);
      roundRect(ctx, x, y, 30, 34, 3);
      ctx.fill();
    }
  }

  ctx.fillStyle = herniPaleta.kamen;
  ctx.fillRect(0, STREET_TOP - 20, WORLD_W, 20);
  ctx.fillStyle = withAlpha(muted, 0.08);
  ctx.fillRect(0, STREET_TOP, WORLD_W, STREET_BOTTOM - STREET_TOP + 30);

  // Dělicí čáry vozovky naznačí hloubku.
  ctx.strokeStyle = withAlpha(muted, 0.16);
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const y = STREET_TOP + 24 + i * 40;
    ctx.beginPath();
    ctx.setLineDash([26, 22]);
    ctx.lineDashOffset = -(phase * 0.3) % 48;
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  const scale = Math.min(width / WORLD_W, height / WORLD_H);
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);
  c.save();
  c.translate((width - WORLD_W * scale) / 2, (height - WORLD_H * scale) / 2);
  c.scale(scale, scale);
  drawStreet(c, t * 60, paleta.textTlumeny);

  const swing = Math.sin(t * 3) > 0;
  drawFighter(
    c,
    { x: 250, y: 320, health: 5, maxHealth: 5, facing: 1, attackTicks: swing ? 5 : 0, attack: 'pesti', cooldown: 0, hurtTicks: 0, knockback: 0 },
    herniPaleta.zluta, t * 60,
    swing ? { x: 280, y: 280, w: 26, h: 32 } : null,
  );
  drawFighter(
    c,
    { x: 330, y: 320, health: 3, maxHealth: 3, facing: -1, attackTicks: 0, attack: 'pesti', cooldown: 0, hurtTicks: swing ? 4 : 0, knockback: 0 },
    herniPaleta.cervena, t * 60, null,
  );
  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: WORLD_W, logicalHeight: WORLD_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const game: BitkaGame = createPoulicniBitka(ctx.seed);
  const recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode: ctx.mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let lastScore = 0;
  let lastHealth = game.state.player.health;

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

  const draw = (): void => {
    const c = surface.ctx;
    const s = game.state;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, WORLD_W, WORLD_H);
    drawStreet(c, s.tick, ctx.theme.textMuted);

    // Kdo je vepředu v hloubce, kreslí se navrch.
    // Hráč má vlastní barvu, ne barvu kategorie: ta je u akčních her
    // červená a splynul by s rváči.
    const cast: { fighter: Fighter; color: string; enemy: Enemy | null }[] = [
      { fighter: s.player, color: herniPaleta.zluta, enemy: null },
      ...s.enemies.map((enemy) => ({
        fighter: enemy as Fighter,
        color: enemy.kind === 'hromotluk' ? herniPaleta.fialova : herniPaleta.cervena,
        enemy,
      })),
    ].sort((a, b) => a.fighter.y - b.fighter.y);

    for (const item of cast) {
      drawFighter(c, item.fighter, item.color, s.tick, game.attackBox(item.fighter));
      if (item.enemy && item.enemy.health < item.enemy.maxHealth) {
        const w = FIGHTER_W;
        c.fillStyle = withAlpha(paleta.noc, 0.6);
        c.fillRect(item.fighter.x, item.fighter.y - FIGHTER_H - 12, w, 4);
        c.fillStyle = herniPaleta.zelena;
        c.fillRect(
          item.fighter.x, item.fighter.y - FIGHTER_H - 12,
          w * (item.enemy.health / item.enemy.maxHealth), 4,
        );
      }
    }

    // HUD
    c.font = '500 14px system-ui, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText(`Vlna ${s.wave}`, 16, 14);

    for (let i = 0; i < s.player.maxHealth; i++) {
      c.fillStyle = i < s.player.health ? herniPaleta.cervena : withAlpha(ctx.theme.text, 0.15);
      roundRect(c, 16 + i * 13, 34, 9, 9, 2);
      c.fill();
    }

    c.textAlign = 'right';
    c.font = '600 22px system-ui, sans-serif';
    c.fillStyle = ctx.theme.text;
    c.fillText(String(s.score), WORLD_W - 16, 12);
    if (s.combo > 1) {
      c.font = '600 16px system-ui, sans-serif';
      c.fillStyle = herniPaleta.zluta;
      c.fillText(`kombo ×${s.combo}`, WORLD_W - 16, 40);
    }

    if (s.enemies.length === 0 && s.toSpawn > 0) {
      centerText(c, `Vlna ${s.wave}`, WORLD_W / 2, 60,
        '600 24px system-ui, sans-serif', withAlpha(ctx.theme.accent, 0.8));
    }
  };

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();
        const mask = input.snapshot();
        recorder.record(mask);

        const attackBefore = game.state.player.attackTicks;
        game.step(mask);
        if (game.state.player.attackTicks > attackBefore) ctx.audio.play('move');

        if (game.state.player.health < lastHealth) ctx.audio.play('hit');
        lastHealth = game.state.player.health;

        if (game.state.score !== lastScore) {
          if (game.state.score - lastScore > 50) ctx.audio.play('lock');
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
