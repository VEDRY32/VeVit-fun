/** Oheň a Voda — kooperativní plošinovka pro dva na jedné klávesnici. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createReplayRecorder, roundRect, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createOhenVoda, TILE, type OhenVodaGame, type Hero, type HeroKind,
} from '@vevit-games/rules/ohen-a-voda';
import { manifest } from './manifest.js';

const VIEW_W = 624;
const VIEW_H = 338;

export { manifest };

/**
 * Voda hraje na šipkách (první sada), Oheň na WASD (druhá sada, kterou
 * portál přidá podle manifestu). Šipky proto nesmí mít WASD jako druhou
 * možnost, jinak by jedna klávesa hýbala oběma postavami.
 */
export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  a: ['ArrowUp'],
};

export const controlHints = [
  { action: 'left', label: 'Voda', keys: '← ↑ →' },
  { action: 'up', label: 'Oheň', keys: 'A W D' },
];

const HERO_COLOR: Record<HeroKind, string> = {
  ohen: herniPaleta.oranzova,
  voda: herniPaleta.modra,
};

function drawHero(ctx: CanvasRenderingContext2D, hero: Hero, phase: number): void {
  const b = hero.body;
  const color = HERO_COLOR[hero.kind];
  const bob = hero.body.onGround ? Math.sin(phase * 0.2) * 0.8 : 0;

  // Tělo je kapka: Oheň špičkou nahoru, Voda dolů.
  ctx.fillStyle = color;
  ctx.beginPath();
  if (hero.kind === 'ohen') {
    ctx.moveTo(b.x + b.w / 2, b.y + bob);
    ctx.quadraticCurveTo(b.x + b.w, b.y + b.h * 0.5, b.x + b.w * 0.82, b.y + b.h);
    ctx.lineTo(b.x + b.w * 0.18, b.y + b.h);
    ctx.quadraticCurveTo(b.x, b.y + b.h * 0.5, b.x + b.w / 2, b.y + bob);
  } else {
    ctx.moveTo(b.x + b.w / 2, b.y + b.h);
    ctx.quadraticCurveTo(b.x, b.y + b.h * 0.45, b.x + b.w * 0.16, b.y + bob);
    ctx.lineTo(b.x + b.w * 0.84, b.y + bob);
    ctx.quadraticCurveTo(b.x + b.w, b.y + b.h * 0.45, b.x + b.w / 2, b.y + b.h);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = paleta.noc;
  for (const dx of [0.34, 0.66]) {
    ctx.beginPath();
    ctx.arc(b.x + b.w * dx + hero.facing * 1.2, b.y + b.h * 0.45, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTile(
  ctx: CanvasRenderingContext2D, char: string, x: number, y: number,
  gateOpen: boolean, accent: string, phase: number,
): void {
  switch (char) {
    case '#':
      ctx.fillStyle = herniPaleta.kamen;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = withAlpha('#ffffff', 0.07);
      ctx.fillRect(x, y, TILE, 3);
      break;
    case '=':
      ctx.fillStyle = herniPaleta.hneda;
      roundRect(ctx, x, y + 3, TILE, TILE - 9, 3);
      ctx.fill();
      break;
    case 'f':
    case 'w':
    case 'x': {
      // Kaluž se vlní; barva říká, kdo jí projde.
      const color = char === 'f' ? herniPaleta.oranzova
        : char === 'w' ? herniPaleta.modra : herniPaleta.limetka;
      ctx.fillStyle = withAlpha(color, 0.75);
      ctx.beginPath();
      ctx.moveTo(x, y + TILE);
      for (let i = 0; i <= TILE; i += 4) {
        ctx.lineTo(x + i, y + 6 + Math.sin((x + i) * 0.16 + phase * 0.08) * 2.5);
      }
      ctx.lineTo(x + TILE, y + TILE);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'B':
      ctx.fillStyle = herniPaleta.zluta;
      roundRect(ctx, x + 4, y + TILE - 8, TILE - 8, 6, 3);
      ctx.fill();
      break;
    case 'G':
      if (gateOpen) {
        ctx.strokeStyle = withAlpha(herniPaleta.zluta, 0.3);
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 6, y, TILE - 12, TILE);
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = herniPaleta.zluta;
        roundRect(ctx, x + 5, y, TILE - 10, TILE, 2);
        ctx.fill();
      }
      break;
    case 'D':
    case 'E': {
      const color = char === 'D' ? herniPaleta.oranzova : herniPaleta.modra;
      ctx.fillStyle = withAlpha(color, 0.25);
      roundRect(ctx, x + 2, y - TILE + 4, TILE - 4, TILE * 2 - 6, 5);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      roundRect(ctx, x + 2, y - TILE + 4, TILE - 4, TILE * 2 - 6, 5);
      ctx.stroke();
      break;
    }
    default:
      void accent;
      break;
  }
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);

  const scale = height / VIEW_H;
  c.save();
  c.scale(scale, scale);

  const groundY = VIEW_H - TILE * 2;
  for (let x = 0; x < width / scale + TILE; x += TILE) {
    drawTile(c, '#', x, groundY + TILE, false, paleta.zelena, t * 60);
  }
  for (let x = TILE * 4; x < TILE * 7; x += TILE) {
    drawTile(c, 'f', x, groundY, false, paleta.zelena, t * 60);
  }
  for (let x = TILE * 9; x < TILE * 12; x += TILE) {
    drawTile(c, 'w', x, groundY, false, paleta.zelena, t * 60);
  }

  const hop = Math.abs(Math.sin(t * 2)) * 26;
  drawHero(c, {
    kind: 'ohen', facing: 1, coyote: 0, atDoor: false, dead: false,
    body: { x: TILE * 2, y: groundY - 22 - hop, w: 16, h: 22, vx: 0, vy: 0, onGround: hop < 1, hitWall: false, hitCeiling: false },
  }, t * 60);
  drawHero(c, {
    kind: 'voda', facing: -1, coyote: 0, atDoor: false, dead: false,
    body: { x: TILE * 13, y: groundY - 22 - (26 - hop), w: 16, h: 22, vx: 0, vy: 0, onGround: false, hitWall: false, hitCeiling: false },
  }, t * 60);
  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });
  const input = ctx.input;
  const input2 = ctx.input2 ?? null;

  const game: OhenVodaGame = createOhenVoda(ctx.seed);
  const recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode: ctx.mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
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
      replay: recorder.finish(),
      stats: { uroven: game.state.level + 1 },
    });
    ctx.emit({
      type: 'win', score: game.state.score, durationMs,
      stats: { uroven: game.state.level + 1 },
    });
  };

  const draw = (): void => {
    const c = surface.ctx;
    const s = game.state;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    const offsetX = (VIEW_W - s.width * TILE) / 2;
    const offsetY = (VIEW_H - s.height * TILE) / 2;
    c.save();
    c.translate(offsetX, offsetY);

    for (let ty = 0; ty < s.height; ty++) {
      for (let tx = 0; tx < s.width; tx++) {
        drawTile(c, game.charAt(tx, ty), tx * TILE, ty * TILE, s.gateOpen, ctx.theme.accent, s.ticks);
      }
    }

    for (const gem of s.gems) {
      if (gem.taken) continue;
      c.fillStyle = HERO_COLOR[gem.kind];
      c.beginPath();
      c.moveTo(gem.x, gem.y - 6);
      c.lineTo(gem.x + 5, gem.y);
      c.lineTo(gem.x, gem.y + 6);
      c.lineTo(gem.x - 5, gem.y);
      c.closePath();
      c.fill();
    }

    drawHero(c, s.ohen, s.ticks);
    drawHero(c, s.voda, s.ticks);
    c.restore();

    // HUD
    c.font = '500 13px system-ui, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText(`Úroveň ${s.level + 1}/${game.levels.length} · ${game.levels[s.level]?.name ?? ''}`, 12, 10);
    c.textAlign = 'right';
    c.fillStyle = ctx.theme.text;
    c.font = '600 18px system-ui, sans-serif';
    c.fillText(String(s.score), VIEW_W - 12, 8);

    if (s.failed) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.8);
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      const who = s.ohen.dead ? 'Oheň' : 'Voda';
      centerText(c, `${who} to nepřežil${s.ohen.dead ? '' : 'a'}`, VIEW_W / 2, VIEW_H / 2 - 10,
        '600 24px system-ui, sans-serif', herniPaleta.cervena);
      centerText(c, 'Úroveň se za chvíli postaví znovu', VIEW_W / 2, VIEW_H / 2 + 20,
        '500 14px system-ui, sans-serif', ctx.theme.textMuted);
    } else if (s.levelDone) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.8);
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      centerText(c, 'Oba ve dveřích!', VIEW_W / 2, VIEW_H / 2,
        '600 26px system-ui, sans-serif', ctx.theme.accent);
    }
  };

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();
        input2?.sample();
        const maskVoda = input.snapshot();
        const maskOhen = input2?.snapshot() ?? 0;
        // Do replaye jde obojí v jedné masce: první hráč dole, druhý nahoře.
        recorder.record((maskVoda & 0xffff) | ((maskOhen & 0xffff) << 16));

        game.step(maskOhen, maskVoda);

        if (game.state.score !== lastScore) {
          ctx.audio.play('pickup');
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
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, controlHints };
