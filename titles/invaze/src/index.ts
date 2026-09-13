/**
 * Invaze — nepřátelé z geometrických tvarů, jemný CRT efekt.
 *
 * Žádné cizí sprity: každý typ nepřítele je poskládaný z obdélníků a kruhů,
 * takže je rozlišitelný tvarem, ne jen barvou (colorblind).
 */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createParticles, createRng,
  roundRect, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createInvaze, FIELD_W, FIELD_H, PLAYER_Y, PLAYER_W, PLAYER_H,
  SHIELD_COLS, SHIELD_ROWS, SHIELD_CELL, SHIELD_Y,
  type Enemy, type EnemyKind, type InvazeDifficulty,
} from '@vevit-games/rules/invaze';
import { manifest } from './manifest.js';

const ENEMY_COLORS: Record<EnemyKind, string> = {
  zakladni: herniPaleta.indigo,
  dvojstrelec: herniPaleta.zluta,
  stitovy: herniPaleta.ruzova,
};

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  a: ['Space'],
};

export const touchButtons = [
  { action: 'left', label: '◀', x: 12, y: 90, size: 62 },
  { action: 'right', label: '▶', x: 30, y: 90, size: 62 },
  { action: 'a', label: '●', x: 86, y: 90, size: 66 },
];

export const controlHints = [
  { action: 'left', label: 'Pohyb lodi', keys: '← →' },
  { action: 'a', label: 'Střelba', keys: 'mezerník' },
];

/** Nepřítel jako geometrický tvar; každý typ má jinou siluetu. */
function drawEnemy(
  ctx: CanvasRenderingContext2D,
  kind: EnemyKind, x: number, y: number, w: number, h: number, phase: number,
): void {
  ctx.fillStyle = ENEMY_COLORS[kind];

  if (kind === 'zakladni') {
    ctx.fillRect(x + 4, y + 2, w - 8, h - 8);
    // Nožičky se střídají, takže formace působí jako by kráčela.
    const swap = phase % 2 === 0;
    ctx.fillRect(x + (swap ? 0 : 2), y + h - 6, 6, 6);
    ctx.fillRect(x + w - (swap ? 6 : 8), y + h - 6, 6, 6);
    return;
  }

  if (kind === 'dvojstrelec') {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h - 4);
    ctx.lineTo(x, y + h - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x + 3, y + h - 5, 5, 5);
    ctx.fillRect(x + w - 8, y + h - 5, 5, 5);
    return;
  }

  // Štítový: kruh v rámečku, který drží i po prvním zásahu.
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, h / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ENEMY_COLORS.stitovy;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);

  const scale = Math.min(width / FIELD_W, height / FIELD_H);
  c.save();
  c.translate((width - FIELD_W * scale) / 2, (height - FIELD_H * scale) / 2);
  c.scale(scale, scale);

  const offset = Math.sin(t * 0.8) * 60;
  const phase = Math.floor(t * 2);
  const kinds: EnemyKind[] = ['stitovy', 'dvojstrelec', 'zakladni', 'zakladni'];

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      drawEnemy(c, kinds[row]!, 80 + offset + col * 44, 120 + row * 40, 26, 18, phase + col);
    }
  }

  const shipX = FIELD_W / 2 + Math.sin(t * 1.4) * 140;
  c.fillStyle = paleta.zelena;
  c.beginPath();
  c.moveTo(shipX, PLAYER_Y);
  c.lineTo(shipX + PLAYER_W / 2, PLAYER_Y + PLAYER_H);
  c.lineTo(shipX - PLAYER_W / 2, PLAYER_Y + PLAYER_H);
  c.closePath();
  c.fill();

  c.fillStyle = paleta.text;
  c.fillRect(shipX - 1.5, PLAYER_Y - ((t * 260) % 300), 3, 12);

  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: FIELD_W, logicalHeight: FIELD_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const difficulty = (ctx.mode === 'snadna' || ctx.mode === 'tezka' ? ctx.mode : 'stredni') as InvazeDifficulty;
  let game = createInvaze(ctx.seed, difficulty);
  const particles = ctx.theme.lowQuality
    ? null
    : createParticles(createRng(`${ctx.seed}:castice`), 220);

  let finished = false;
  let lastScore = 0;
  let lastAlive = game.aliveCount();

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('lose');
    const durationMs = Math.round((game.state.tick * 1000) / 60);
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score: game.state.score, durationMs,
      stats: { vlna: game.state.wave },
    });
    ctx.emit({ type: 'gameover', score: game.state.score, durationMs, stats: { vlna: game.state.wave } });
  };

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, FIELD_W, FIELD_H);

    // Hlavička
    c.font = '500 14px system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText(`Vlna ${game.state.wave}`, 14, 22);
    c.textAlign = 'center';
    c.fillStyle = ctx.theme.text;
    c.font = '600 20px system-ui, sans-serif';
    c.fillText(String(game.state.score), FIELD_W / 2, 22);
    c.textAlign = 'right';
    c.fillStyle = paleta.zelena;
    c.fillText('▲'.repeat(Math.max(0, game.state.lives)), FIELD_W - 14, 22);

    // Ukazatel zahřátí zbraně. Musí být u lodi, ne v hlavičce — hráč se
    // v boji dívá dolů a nahoru nemá kdy koukat.
    const barW = 120;
    const barX = (FIELD_W - barW) / 2;
    const barY = PLAYER_Y + PLAYER_H + 14;
    c.fillStyle = withAlpha(ctx.theme.text, 0.12);
    roundRect(c, barX, barY, barW, 6, 3);
    c.fill();
    const heatColor = game.state.overheated
      ? herniPaleta.cervena
      : game.state.heat > 0.7 ? herniPaleta.oranzova : paleta.zelena;
    c.fillStyle = heatColor;
    roundRect(c, barX, barY, Math.max(2, barW * game.state.heat), 6, 3);
    c.fill();
    if (game.state.overheated) {
      c.textAlign = 'center';
      c.font = '600 12px system-ui, sans-serif';
      c.fillStyle = herniPaleta.cervena;
      c.fillText('PŘEHŘÁTO', FIELD_W / 2, barY + 20);
    }

    const phase = Math.floor(game.state.tick / 20);
    for (const enemy of game.state.enemies as Enemy[]) {
      if (!enemy.alive) continue;
      const rect = game.enemyRect(enemy);
      drawEnemy(c, enemy.kind, rect.x, rect.y, rect.w, rect.h, phase);
    }

    if (game.state.saucer.active) {
      c.fillStyle = herniPaleta.fialova;
      c.beginPath();
      c.ellipse(game.state.saucer.x, 52, 22, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(game.state.saucer.x, 46, 9, Math.PI, 0);
      c.fill();
    }

    for (const shield of game.state.shields) {
      for (let row = 0; row < SHIELD_ROWS; row++) {
        for (let col = 0; col < SHIELD_COLS; col++) {
          if (!shield.cells[row]![col]) continue;
          c.fillStyle = herniPaleta.tyrkys;
          c.fillRect(shield.x + col * SHIELD_CELL, SHIELD_Y + row * SHIELD_CELL, SHIELD_CELL, SHIELD_CELL);
        }
      }
    }

    particles?.render(c);

    for (const shot of game.state.shots) {
      c.fillStyle = shot.fromPlayer ? ctx.theme.text : herniPaleta.ruzova;
      c.fillRect(shot.x - 1.5, shot.y - 6, 3, 12);
    }

    // Loď bliká, dokud běží odpočet po zásahu.
    const hidden = game.state.respawnTimer > 0 && Math.floor(game.state.tick / 6) % 2 === 0;
    if (!hidden) {
      c.fillStyle = paleta.zelena;
      c.beginPath();
      c.moveTo(game.state.playerX, PLAYER_Y);
      c.lineTo(game.state.playerX + PLAYER_W / 2, PLAYER_Y + PLAYER_H);
      c.lineTo(game.state.playerX - PLAYER_W / 2, PLAYER_Y + PLAYER_H);
      c.closePath();
      c.fill();
    }

    // Jemný CRT efekt: vodorovné linky přes celou plochu.
    if (!ctx.theme.lowQuality && !ctx.theme.reducedMotion) {
      c.fillStyle = withAlpha('#000000', 0.13);
      for (let y = 0; y < FIELD_H; y += 3) c.fillRect(0, y, FIELD_W, 1);
    }

    if (game.state.over) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.82);
      c.fillRect(0, 0, FIELD_W, FIELD_H);
      centerText(c, 'Konec invaze', FIELD_W / 2, FIELD_H / 2,
        '600 34px system-ui, sans-serif', herniPaleta.ruzova);
    }
  };

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();
        game.step(input.held('left'), input.held('right'), input.held('a'));
        particles?.update();

        const alive = game.aliveCount();
        if (alive !== lastAlive) {
          lastAlive = alive;
          ctx.audio.play('hit');
        }
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
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, touchButtons, controlHints };
