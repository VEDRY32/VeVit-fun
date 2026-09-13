/** Had — plynulá zaoblená křivka s očima, ne řada čtverců. */

import {
  paleta, herniPaleta,
  createLoop, createSurface, createReplayRecorder, withAlpha, centerText,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import { createHad, type HadMode, type Dir, type BonusKind } from '@vevit-games/rules/had';
import { manifest } from './manifest.js';

const VIEW = 600;
const GRID = 20;
const CELL = VIEW / GRID;

/** Zdi pro režim bludiště — vlastní rozvržení, čtyři bloky u rohů. */
const MAZE_WALLS = (() => {
  const walls: { x: number; y: number }[] = [];
  for (let i = 4; i <= 7; i++) {
    walls.push({ x: i, y: 4 }, { x: GRID - 1 - i, y: 4 });
    walls.push({ x: i, y: GRID - 5 }, { x: GRID - 1 - i, y: GRID - 5 });
  }
  for (let i = 8; i <= 11; i++) {
    walls.push({ x: 4, y: i }, { x: GRID - 5, y: i });
  }
  return walls;
})();

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
};

/**
 * Had se ovládá hlavně švihem přes celou plochu; kříž je záloha, proto sedí
 * v rozích, kde překrývá nejmíň hracího pole.
 */
export const touchButtons = [
  { action: 'left', label: '◀', x: 8, y: 92, size: 56 },
  { action: 'right', label: '▶', x: 24, y: 92, size: 56 },
  { action: 'up', label: '▲', x: 76, y: 92, size: 56 },
  { action: 'down', label: '▼', x: 92, y: 92, size: 56 },
];

export const controlHints = [
  { action: 'left', label: 'Zatáčení', keys: '← ↑ → ↓' },
];

function drawSnakeBody(
  ctx: CanvasRenderingContext2D,
  body: { x: number; y: number }[],
  color: string,
  cell: number,
): void {
  if (body.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = cell * 0.74;

  // Průchod okrajem rozpojí křivku — kreslíme ji po souvislých úsecích.
  let segment: { x: number; y: number }[] = [body[0]!];
  for (let i = 1; i < body.length; i++) {
    const prev = body[i - 1]!;
    const current = body[i]!;
    const jumped = Math.abs(prev.x - current.x) > 1 || Math.abs(prev.y - current.y) > 1;
    if (jumped) {
      segment = [current];
      continue;
    }
    segment.push(current);
    if (segment.length >= 2) {
      ctx.beginPath();
      ctx.moveTo((prev.x + 0.5) * cell, (prev.y + 0.5) * cell);
      ctx.lineTo((current.x + 0.5) * cell, (current.y + 0.5) * cell);
      ctx.stroke();
    }
  }

  // Hlava dostane kroužek navíc a oči.
  const head = body[0]!;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc((head.x + 0.5) * cell, (head.y + 0.5) * cell, cell * 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = paleta.noc;
  for (const offset of [-0.16, 0.16]) {
    ctx.beginPath();
    ctx.arc((head.x + 0.5 + offset) * cell, (head.y + 0.42) * cell, cell * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);

  /**
   * Mřížka je záměrně hustá: ukázka se kreslí i do hero pruhu 960×540
   * a při málo velkých políčkách by z hada byl nečitelný zelený válec.
   */
  const cols = 24;
  const rows = 14;
  const cell = Math.min(width / cols, height / rows);
  const offsetX = (width - cols * cell) / 2;
  const offsetY = (height - rows * cell) / 2;

  c.save();
  c.translate(offsetX, offsetY);

  // Jemná mřížka, ať je vidět, že se hraje na políčkách.
  c.strokeStyle = 'rgba(238,242,255,0.05)';
  c.lineWidth = 1;
  c.beginPath();
  for (let x = 0; x <= cols; x++) {
    c.moveTo(x * cell, 0);
    c.lineTo(x * cell, rows * cell);
  }
  for (let y = 0; y <= rows; y++) {
    c.moveTo(0, y * cell);
    c.lineTo(cols * cell, y * cell);
  }
  c.stroke();

  // Had krouží po obvodu — jednoduchá, ale čitelná ukázka.
  const perimeter: { x: number; y: number }[] = [];
  for (let x = 2; x < cols - 2; x++) perimeter.push({ x, y: 2 });
  for (let y = 2; y < rows - 2; y++) perimeter.push({ x: cols - 3, y });
  for (let x = cols - 3; x > 1; x--) perimeter.push({ x, y: rows - 3 });
  for (let y = rows - 3; y > 1; y--) perimeter.push({ x: 2, y });

  const head = Math.floor(t * 9) % perimeter.length;
  const body = Array.from({ length: 14 }, (_, i) =>
    perimeter[(head - i + perimeter.length * 2) % perimeter.length]!,
  );

  const food = perimeter[(head + 20) % perimeter.length]!;
  c.fillStyle = herniPaleta.zluta;
  c.beginPath();
  c.arc((food.x + 0.5) * cell, (food.y + 0.5) * cell, cell * 0.28, 0, Math.PI * 2);
  c.fill();

  drawSnakeBody(c, body, paleta.zelena, cell);
  c.restore();
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW, logicalHeight: VIEW, letterbox: ctx.theme.background,
  });
  const { input } = ctx;
  const mode = ctx.mode as HadMode;

  const makeGame = () =>
    createHad(ctx.seed, {
      width: GRID, height: GRID, mode,
      walls: mode === 'bludiste' ? MAZE_WALLS : [],
    });

  let game = makeGame();
  let recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let lastScore = 0;
  let pulse = 0;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('lose');
    const durationMs = Math.round((game.state.tick * 1000) / 60);
    void ctx.scores.submit({
      runId: null, mode, score: game.state.score, durationMs,
      replay: recorder.finish(),
      stats: { delka: game.state.length },
    });
    ctx.emit({ type: 'gameover', score: game.state.score, durationMs, stats: { delka: game.state.length } });
  };

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW, VIEW);

    c.strokeStyle = withAlpha(ctx.theme.text, 0.04);
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 1; i < GRID; i++) {
      c.moveTo(i * CELL, 0);
      c.lineTo(i * CELL, VIEW);
      c.moveTo(0, i * CELL);
      c.lineTo(VIEW, i * CELL);
    }
    c.stroke();

    for (const wall of game.config.walls) {
      c.fillStyle = ctx.theme.surface;
      c.fillRect(wall.x * CELL + 2, wall.y * CELL + 2, CELL - 4, CELL - 4);
    }

    // Jídlo pulzuje — pohyb jako odpověď na stav hry, ne dekorace.
    const scale = ctx.theme.reducedMotion ? 1 : 1 + Math.sin(pulse * 0.12) * 0.12;
    c.fillStyle = ctx.theme.accent;
    c.beginPath();
    c.arc(
      (game.state.food.x + 0.5) * CELL, (game.state.food.y + 0.5) * CELL,
      CELL * 0.28 * scale, 0, Math.PI * 2,
    );
    c.fill();

    if (game.state.golden) {
      c.fillStyle = herniPaleta.zluta;
      c.beginPath();
      c.arc(
        (game.state.golden.x + 0.5) * CELL, (game.state.golden.y + 0.5) * CELL,
        CELL * 0.32 * scale, 0, Math.PI * 2,
      );
      c.fill();
      // Ubývající prstenec ukazuje, kolik času zbývá.
      c.strokeStyle = herniPaleta.zluta;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(
        (game.state.golden.x + 0.5) * CELL, (game.state.golden.y + 0.5) * CELL,
        CELL * 0.46, -Math.PI / 2,
        -Math.PI / 2 + (game.state.goldenTicks / (5 * 60)) * Math.PI * 2,
      );
      c.stroke();
    }

    const bonus = game.state.bonus;
    if (bonus) {
      const bx = (bonus.at.x + 0.5) * CELL;
      const by = (bonus.at.y + 0.5) * CELL;
      const color = bonus.kind === 'magnet' ? herniPaleta.tyrkys : herniPaleta.ruzova;
      c.strokeStyle = color;
      c.lineWidth = 2.5;
      c.lineCap = 'round';
      if (bonus.kind === 'magnet') {
        // Podkova otevřená dolů, hroty dokreslené plnou barvou.
        c.beginPath();
        c.arc(bx, by - CELL * 0.04, CELL * 0.26, Math.PI, 0);
        c.stroke();
        c.fillStyle = color;
        c.fillRect(bx - CELL * 0.32, by - CELL * 0.04, CELL * 0.12, CELL * 0.22);
        c.fillRect(bx + CELL * 0.2, by - CELL * 0.04, CELL * 0.12, CELL * 0.22);
      } else {
        // Nůžky: dvě zkřížené čepele a očko.
        c.beginPath();
        c.moveTo(bx - CELL * 0.26, by - CELL * 0.26);
        c.lineTo(bx + CELL * 0.18, by + CELL * 0.18);
        c.moveTo(bx + CELL * 0.26, by - CELL * 0.26);
        c.lineTo(bx - CELL * 0.18, by + CELL * 0.18);
        c.stroke();
      }
    }

    drawSnakeBody(surface.ctx, game.state.body, paleta.zelena, CELL);

    // Magnet je vidět na hlavě, ne jen v HUD — hráč se dívá na hada.
    if (game.state.magnetTicks > 0) {
      const head = game.state.body[0]!;
      c.strokeStyle = withAlpha(herniPaleta.tyrkys, 0.6);
      c.lineWidth = 2;
      c.beginPath();
      c.arc((head.x + 0.5) * CELL, (head.y + 0.5) * CELL, CELL * 0.9, 0, Math.PI * 2);
      c.stroke();
    }

    centerText(
      c, String(game.state.score), VIEW / 2, 26,
      '600 22px system-ui, sans-serif', withAlpha(ctx.theme.text, 0.6),
    );
  };

  // Bonus se sebere uvnitř kroku pravidel; tady si držíme, co na ploše
  // leželo před ním, aby šlo poznat sebrání od vypršení času.
  let bonusBefore: BonusKind | null = null;
  let bonusAt = { x: -1, y: -1 };

  const loop = createLoop(
    {
      update() {
        if (finished) return;
        input.sample();
        const mask = input.snapshot();
        recorder.record(mask);
        game.step(mask);
        pulse++;

        if (game.state.score !== lastScore) {
          ctx.audio.play('pickup');
          lastScore = game.state.score;
          ctx.emit({ type: 'score', value: lastScore });
        }

        // Bonus nemění skóre, takže vlastní zvuk musí hlídat jeho zmizení
        // pod hlavou — jinak by sebrání proběhlo úplně potichu.
        const bonusNow = game.state.bonus?.kind ?? null;
        if (bonusBefore != null && bonusNow == null) {
          const head = game.state.body[0]!;
          if (head.x === bonusAt.x && head.y === bonusAt.y) {
            ctx.audio.play(bonusBefore === 'magnet' ? 'levelUp' : 'clear');
          }
        }
        bonusBefore = bonusNow;
        if (game.state.bonus) bonusAt = game.state.bonus.at;
        if (game.state.over) finish();
      },
      render() {
        surface.begin();
        draw();
      },
    },
    { onAutoPause: () => ctx.emit({ type: 'paused' }) },
  );

  // Švih prstem místo virtuálního kříže.
  let swipeStart: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent): void => { swipeStart = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: PointerEvent): void => {
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.hypot(dx, dy) < 24) return;
    const direction: Dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
    game.turn(direction);
  };
  surface.canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);

  loop.start();
  ctx.emit({ type: 'ready' });
  ctx.emit({ type: 'started' });

  return {
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    destroy() {
      loop.stop();
      surface.canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, touchButtons, controlHints };
