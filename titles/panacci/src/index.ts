/** Panáčci — malá strategie na jedné linii. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createReplayRecorder, roundRect, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createPanacci, UNITS, BUYABLE, LANE_LENGTH, BASE_HP,
  type PanacciGame, type Unit, type UnitKind, type Difficulty,
} from '@vevit-games/rules/panacci';
import { manifest } from './manifest.js';

const VIEW_W = 900;
const VIEW_H = 360;
const GROUND_Y = 250;
const BAR_Y = 282;

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['Digit1'],
  up: ['Digit2'],
  right: ['Digit3'],
  down: ['Digit4'],
};

export const controlHints = [
  { action: 'pointer', label: 'Nákup jednotek', keys: 'klik / tap' },
  { action: 'left', label: 'Kopáč, mečník, lučištník, obrněnec', keys: '1 2 3 4' },
];

const UNIT_COLOR: Record<UnitKind, string> = {
  kopac: herniPaleta.zluta,
  mecnik: herniPaleta.modra,
  lucistnik: herniPaleta.tyrkys,
  obrnenec: herniPaleta.fialova,
};

/**
 * Panáček: hlava, tělo a končetiny čárou. Vlastní kresba, žádná předloha —
 * tvar se liší podle druhu, aby šly od sebe rozeznat i v hromadě.
 */
function drawUnit(ctx: CanvasRenderingContext2D, unit: Unit, phase: number): void {
  const color = unit.side === 'hrac' ? UNIT_COLOR[unit.kind] : herniPaleta.cervena;
  const scale = unit.kind === 'obrnenec' ? 1.35 : unit.kind === 'kopac' ? 0.85 : 1;
  const h = 34 * scale;
  const x = unit.x;
  const y = GROUND_Y;
  const facing = unit.side === 'hrac' ? 1 : -1;
  const step = unit.striking > 0 ? 0 : Math.sin(phase * 0.2 + unit.x) * 3;

  ctx.fillStyle = withAlpha(paleta.noc, 0.45);
  ctx.beginPath();
  ctx.ellipse(x, y, 9 * scale, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.42);
  ctx.lineTo(x, y - h * 0.1);
  ctx.moveTo(x, y - h * 0.1);
  ctx.lineTo(x - 5 * scale + step, y);
  ctx.moveTo(x, y - h * 0.1);
  ctx.lineTo(x + 5 * scale - step, y);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - h * 0.56, 6 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Nástroj podle druhu: krumpáč, meč, luk, štít.
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  const armY = y - h * 0.34;
  const reach = unit.striking > 0 ? 16 : 11;
  if (unit.kind === 'kopac') {
    ctx.moveTo(x, armY);
    ctx.lineTo(x + facing * reach, armY + 6);
  } else if (unit.kind === 'mecnik') {
    ctx.moveTo(x, armY);
    ctx.lineTo(x + facing * reach, armY - 10);
  } else if (unit.kind === 'lucistnik') {
    ctx.moveTo(x + facing * 8, armY - 8);
    ctx.quadraticCurveTo(x + facing * 15, armY, x + facing * 8, armY + 8);
  } else {
    ctx.moveTo(x + facing * 9, armY - 10);
    ctx.lineTo(x + facing * 9, armY + 10);
  }
  ctx.stroke();

  if (unit.hp < unit.maxHp) {
    ctx.fillStyle = withAlpha(paleta.noc, 0.6);
    ctx.fillRect(x - 11, y - h - 10, 22, 3);
    ctx.fillStyle = herniPaleta.zelena;
    ctx.fillRect(x - 11, y - h - 10, 22 * (unit.hp / unit.maxHp), 3);
  }
}

function drawBase(
  ctx: CanvasRenderingContext2D, x: number, hp: number, color: string, facing: 1 | -1,
): void {
  const w = 56;
  ctx.fillStyle = withAlpha(color, 0.25);
  roundRect(ctx, x - w / 2, GROUND_Y - 96, w, 96, 6);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  roundRect(ctx, x - w / 2, GROUND_Y - 96, w, 96, 6);
  ctx.stroke();

  // Cimbuří na straně, ze které přicházejí nepřátelé.
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x - w / 2 + 6 + i * 18, GROUND_Y - 106, 10, 12);
  }
  ctx.fillRect(x + facing * (w / 2 - 6), GROUND_Y - 60, 6, 60);

  ctx.fillStyle = withAlpha(paleta.noc, 0.6);
  ctx.fillRect(x - w / 2, GROUND_Y - 116, w, 5);
  ctx.fillStyle = hp > BASE_HP * 0.3 ? herniPaleta.zelena : herniPaleta.cervena;
  ctx.fillRect(x - w / 2, GROUND_Y - 116, w * Math.max(0, hp / BASE_HP), 5);
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);

  const scale = Math.min(width / VIEW_W, height / VIEW_H);
  c.save();
  c.translate((width - VIEW_W * scale) / 2, (height - VIEW_H * scale) / 2);
  c.scale(scale, scale);

  c.strokeStyle = withAlpha(paleta.textTlumeny, 0.2);
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, GROUND_Y);
  c.lineTo(VIEW_W, GROUND_Y);
  c.stroke();

  drawBase(c, 60, BASE_HP, herniPaleta.modra, 1);
  drawBase(c, LANE_LENGTH - 60, BASE_HP * 0.6, herniPaleta.cervena, -1);

  const march = (t * 40) % 300;
  for (let i = 0; i < 3; i++) {
    drawUnit(c, {
      kind: i === 0 ? 'obrnenec' : 'mecnik', side: 'hrac',
      x: 160 + march + i * 46, hp: 10, maxHp: 10, cooldown: 0, striking: 0,
    }, t * 60);
    drawUnit(c, {
      kind: 'lucistnik', side: 'souper',
      x: LANE_LENGTH - 200 - march - i * 40, hp: 10, maxHp: 10, cooldown: 0, striking: 0,
    }, t * 60);
  }
  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const difficulty = (['snadna', 'stredni', 'tezka'].includes(ctx.mode)
    ? ctx.mode
    : 'stredni') as Difficulty;
  const game: PanacciGame = createPanacci(ctx.seed, difficulty);
  const recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode: ctx.mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let lastScore = 0;
  let lastUnits = 0;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    const won = game.state.won;
    ctx.audio.play(won ? 'win' : 'lose');
    const durationMs = game.state.tick * (1000 / 60);
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score: game.state.score, durationMs,
      replay: recorder.finish(),
      stats: { zaklandna: Math.round(game.state.baseHp) },
    });
    ctx.emit({
      type: won ? 'win' : 'gameover', score: game.state.score, durationMs,
      stats: { zaklandna: Math.round(game.state.baseHp) },
    });
  };

  /** Tlačítka nákupu pod linií. */
  const buttons = (): { kind: UnitKind; x: number; y: number; w: number; h: number }[] => {
    const w = 200;
    const gap = 14;
    const total = w * BUYABLE.length + gap * (BUYABLE.length - 1);
    return BUYABLE.map((kind, i) => ({
      kind,
      x: (VIEW_W - total) / 2 + i * (w + gap),
      y: BAR_Y,
      w, h: 62,
    }));
  };

  const draw = (): void => {
    const c = surface.ctx;
    const s = game.state;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    // Linie a pozadí
    c.fillStyle = withAlpha(ctx.theme.text, 0.03);
    c.fillRect(0, GROUND_Y, VIEW_W, BAR_Y - GROUND_Y);
    c.strokeStyle = withAlpha(ctx.theme.textMuted, 0.25);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, GROUND_Y);
    c.lineTo(VIEW_W, GROUND_Y);
    c.stroke();

    drawBase(c, 60, s.baseHp, herniPaleta.modra, 1);
    drawBase(c, LANE_LENGTH - 60, s.enemyBaseHp, herniPaleta.cervena, -1);

    for (const unit of s.units) drawUnit(c, unit, s.tick);

    // HUD
    c.font = '600 20px system-ui, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = herniPaleta.zluta;
    c.fillText(`${Math.floor(s.gold)} zlata`, 16, 14);
    c.font = '500 13px system-ui, sans-serif';
    c.fillStyle = ctx.theme.textMuted;
    c.fillText(`Příjem ${(game.income('hrac') * 60).toFixed(1)}/s`, 16, 40);

    c.textAlign = 'right';
    c.font = '600 20px system-ui, sans-serif';
    c.fillStyle = ctx.theme.text;
    c.fillText(String(s.score), VIEW_W - 16, 14);

    // Nákupní tlačítka
    buttons().forEach((button, i) => {
      const stats = UNITS[button.kind];
      const afford = s.gold >= stats.cost;
      c.fillStyle = afford ? withAlpha(UNIT_COLOR[button.kind], 0.16) : withAlpha(ctx.theme.text, 0.05);
      roundRect(c, button.x, button.y, button.w, button.h, 8);
      c.fill();
      c.strokeStyle = afford ? withAlpha(UNIT_COLOR[button.kind], 0.7) : withAlpha(ctx.theme.text, 0.1);
      c.lineWidth = 2;
      roundRect(c, button.x, button.y, button.w, button.h, 8);
      c.stroke();

      c.textAlign = 'left';
      c.font = '600 15px system-ui, sans-serif';
      c.fillStyle = afford ? ctx.theme.text : withAlpha(ctx.theme.text, 0.35);
      c.fillText(`${i + 1}. ${stats.label}`, button.x + 12, button.y + 10);
      c.font = '500 12px system-ui, sans-serif';
      c.fillStyle = afford ? herniPaleta.zluta : withAlpha(ctx.theme.text, 0.25);
      c.fillText(`${stats.cost} zlata`, button.x + 12, button.y + 32);
      c.fillStyle = ctx.theme.textMuted;
      c.fillText(
        button.kind === 'kopac' ? 'zvedá příjem' : `útok ${stats.damage} · dosah ${stats.range}`,
        button.x + 12, button.y + 46,
      );
    });

    if (s.won || s.over) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.86);
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      centerText(c, s.won ? 'Základna soupeře padla!' : 'Tvoje základna padla',
        VIEW_W / 2, VIEW_H / 2 - 10, '600 28px system-ui, sans-serif',
        s.won ? herniPaleta.zelena : herniPaleta.cervena);
      centerText(c, `${s.score} bodů`, VIEW_W / 2, VIEW_H / 2 + 24,
        '500 16px system-ui, sans-serif', ctx.theme.textMuted);
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (game.state.over || game.state.won) return;
    const local = surface.toLogical(e.clientX, e.clientY);
    for (const button of buttons()) {
      if (local.x < button.x || local.x > button.x + button.w) continue;
      if (local.y < button.y || local.y > button.y + button.h) continue;
      ctx.audio.play(game.buy(button.kind) ? 'click' : 'error');
      return;
    }
  };
  surface.canvas.addEventListener('pointerup', onPointerUp);

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();
        const mask = input.snapshot();
        recorder.record(mask);

        // Číslice 1–4 kupují stejně jako tlačítka.
        const keys: [ 'left' | 'up' | 'right' | 'down', UnitKind ][] = [
          ['left', 'kopac'], ['up', 'mecnik'], ['right', 'lucistnik'], ['down', 'obrnenec'],
        ];
        for (const [action, kind] of keys) {
          if (input.pressed(action)) ctx.audio.play(game.buy(kind) ? 'click' : 'error');
        }

        game.step();

        const units = game.state.units.length;
        if (units < lastUnits) ctx.audio.play('hit');
        lastUnits = units;

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
      surface.canvas.removeEventListener('pointerup', onPointerUp);
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, controlHints };
