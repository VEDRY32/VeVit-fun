/**
 * Pasiánsy — tři varianty nad jedním modelem.
 *
 * Ovládání je dvojí a rovnocenné: táhnutí myší/prstem a tapnutí, které
 * kartu pošle na nejlepší možné místo. Na mobilu je tap výrazně rychlejší.
 */

import {
  paleta, herniPaleta,
  createLoop, createSurface, centerText, withAlpha, easing,
  type GameContext, type GameInstance, type GameModule,
} from '@vevit-games/engine';
import { createPasiansy, type Variant, type Card } from '@vevit-games/rules/pasiansy';
import { manifest } from './manifest.js';
import {
  VIEW_W, VIEW_H, CARD_W, CARD_H, STACK_FACE_DOWN,
  drawCard, drawSlot, layoutFor, cardOffsetY,
  type CardTheme, type PileLayout,
} from './render.js';

/** Režim z manifestu → varianta a její nastavení. */
function configFor(mode: string): { variant: Variant; drawCount: 1 | 3; spiderSuits: 1 | 2 | 4 } {
  switch (mode) {
    case 'klondike3': return { variant: 'klondike', drawCount: 3, spiderSuits: 4 };
    case 'freecell': return { variant: 'freecell', drawCount: 1, spiderSuits: 4 };
    case 'pavouk1': return { variant: 'pavouk', drawCount: 1, spiderSuits: 1 };
    case 'pavouk2': return { variant: 'pavouk', drawCount: 1, spiderSuits: 2 };
    case 'pavouk4': return { variant: 'pavouk', drawCount: 1, spiderSuits: 4 };
    default: return { variant: 'klondike', drawCount: 1, spiderSuits: 4 };
  }
}

export { manifest };

export const controlHints = [
  { action: 'pointer', label: 'Tažení nebo tapnutí karty', keys: 'myš / prst' },
  { action: 'b', label: 'Krok zpět', keys: 'Z' },
  { action: 'x', label: 'Nápověda', keys: 'H' },
  { action: 'a', label: 'Dokončit, co jde', keys: 'mezerník' },
];

export const keymap = {
  b: ['KeyZ'],
  x: ['KeyH'],
  a: ['Space'],
};

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);

  const theme: CardTheme = {
    accent: herniPaleta.zluta, background: paleta.noc, surface: paleta.pult,
    text: paleta.text, textMuted: paleta.textTlumeny, colorblind: false,
  };

  // Vějíř karet, který se pomalu rozevírá — klidná, karetní ukázka.
  const scale = Math.min(width / 420, height / 260);
  c.save();
  c.translate(width / 2, height * 0.62);
  c.scale(scale, scale);

  const cards: Card[] = [
    { id: 1, suit: 'piky', rank: 13, faceUp: true },
    { id: 2, suit: 'srdce', rank: 12, faceUp: true },
    { id: 3, suit: 'kriz', rank: 11, faceUp: true },
    { id: 4, suit: 'kary', rank: 10, faceUp: true },
    { id: 5, suit: 'piky', rank: 9, faceUp: true },
  ];
  const spread = 26 + Math.sin(t * 0.8) * 8;
  cards.forEach((card, i) => {
    const offset = (i - (cards.length - 1) / 2) * spread;
    c.save();
    c.translate(offset, -Math.abs(offset) * 0.12);
    c.rotate(offset * 0.004);
    drawCard(c, card, -CARD_W / 2, -CARD_H, theme);
    c.restore();
  });
  c.restore();
}

interface Dragging {
  from: string;
  count: number;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;
  const settings = configFor(ctx.mode);

  const makeGame = () => createPasiansy(ctx.seed, settings);
  let game = makeGame();
  let layout = layoutFor(settings.variant);
  let finished = false;
  let dragging: Dragging | null = null;
  let hintMove: { from: string; to: string; count: number } | null = null;
  let hintTicks = 0;
  let lastScore = 0;

  const theme: CardTheme = {
    accent: ctx.theme.accent,
    background: ctx.theme.background,
    surface: ctx.theme.surface,
    text: ctx.theme.text,
    textMuted: ctx.theme.textMuted,
    colorblind: ctx.theme.colorblind,
  };

  const layoutOf = (id: string): PileLayout | undefined => layout.find((l) => l.id === id);

  /** Najde kartu pod bodem. Prochází odzadu, aby vyhrála ta navrchu. */
  const cardAt = (x: number, y: number): { pileId: string; index: number } | null => {
    for (let i = layout.length - 1; i >= 0; i--) {
      const spot = layout[i]!;
      const pile = game.state.piles[spot.id];
      if (!pile) continue;

      if (pile.cards.length === 0) {
        if (x >= spot.x && x <= spot.x + CARD_W && y >= spot.y && y <= spot.y + CARD_H) {
          return { pileId: spot.id, index: -1 };
        }
        continue;
      }

      for (let index = pile.cards.length - 1; index >= 0; index--) {
        const cardY = spot.y + cardOffsetY(pile, index, spot.spread);
        // Karta pod jinou je vidět jen v pruhu nahoře; v balíčku vůbec.
        const visibleHeight = index === pile.cards.length - 1
          ? CARD_H
          : spot.spread === 0
            ? 0
            : (pile.cards[index + 1]!.faceUp ? spot.spread : STACK_FACE_DOWN);
        if (x >= spot.x && x <= spot.x + CARD_W && y >= cardY && y <= cardY + visibleHeight) {
          return { pileId: spot.id, index };
        }
      }
    }
    return null;
  };

  /**
   * Animace přesunu. Karty mají stabilní `id`, takže stačí porovnat, kde
   * ležely před tahem a kde leží po něm — a to funguje pro líznutí,
   * poklepání i tažení najednou, bez zvláštní větve pro každý z nich.
   */
  const ANIM_TICKS = 8;
  const anims = new Map<number, { fromX: number; fromY: number; ticks: number }>();

  const positions = (): Map<number, { x: number; y: number }> => {
    const out = new Map<number, { x: number; y: number }>();
    for (const spot of layout) {
      const pile = game.state.piles[spot.id];
      if (!pile) continue;
      pile.cards.forEach((card, index) => {
        out.set(card.id, { x: spot.x, y: spot.y + cardOffsetY(pile, index, spot.spread) });
      });
    }
    return out;
  };

  const withAnimation = (action: () => boolean): boolean => {
    if (ctx.theme.reducedMotion) return action();
    const before = positions();
    const done = action();
    if (!done) return done;
    for (const [id, to] of positions()) {
      const from = before.get(id);
      if (!from) continue;
      if (Math.abs(from.x - to.x) < 0.5 && Math.abs(from.y - to.y) < 0.5) continue;
      anims.set(id, { fromX: from.x, fromY: from.y, ticks: ANIM_TICKS });
    }
    return done;
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('win');
    const durationMs = game.elapsedMs();
    const score = ctx.mode === 'freecell' ? game.state.moves : game.state.score;
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score, durationMs,
      stats: { tahy: game.state.moves },
    });
    ctx.emit({ type: 'win', score, durationMs, stats: { tahy: game.state.moves } });
  };

  const flying: {
    card: Card; x: number; y: number;
    anim: { fromX: number; fromY: number; ticks: number }; isHint: boolean;
  }[] = [];

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    for (const spot of layout) {
      const pile = game.state.piles[spot.id];
      if (!pile) continue;

      if (pile.cards.length === 0) {
        const hint = pile.kind === 'cil' ? 'A' : pile.kind === 'zasoba' ? '↻' : undefined;
        drawSlot(c, spot.x, spot.y, theme, hint);
        continue;
      }

      const draggedCount = dragging?.from === spot.id ? dragging.count : 0;
      const visible = pile.cards.length - draggedCount;

      for (let index = 0; index < visible; index++) {
        const card = pile.cards[index]!;
        const y = spot.y + cardOffsetY(pile, index, spot.spread);
        const isHint = hintTicks > 0 && hintMove?.from === spot.id && index >= pile.cards.length - hintMove.count;
        const anim = anims.get(card.id);
        if (anim) {
          // Letící karty se kreslí až nakonec, aby nemizely pod hromádkami.
          flying.push({ card, x: spot.x, y, anim, isHint });
          continue;
        }
        drawCard(c, card, spot.x, y, theme, isHint);
      }
    }

    for (const item of flying) {
      const t = easing.outCubic(1 - item.anim.ticks / ANIM_TICKS);
      drawCard(
        c, item.card,
        item.anim.fromX + (item.x - item.anim.fromX) * t,
        item.anim.fromY + (item.y - item.anim.fromY) * t,
        theme, item.isHint,
      );
    }
    flying.length = 0;

    // Cíl nápovědy se orámuje taky, ať je vidět, kam tah vede.
    if (hintTicks > 0 && hintMove) {
      const target = layoutOf(hintMove.to);
      if (target) {
        const pile = game.state.piles[hintMove.to]!;
        const y = target.y + cardOffsetY(pile, Math.max(0, pile.cards.length - 1), target.spread);
        c.strokeStyle = theme.accent;
        c.lineWidth = 2.5;
        c.strokeRect(target.x - 3, y - 3, CARD_W + 6, CARD_H + 6);
      }
    }

    // Tažené karty kreslíme nakonec, aby byly nad vším.
    if (dragging) {
      const pile = game.state.piles[dragging.from]!;
      const start = pile.cards.length - dragging.count;
      for (let i = 0; i < dragging.count; i++) {
        drawCard(c, pile.cards[start + i]!, dragging.x, dragging.y + i * 30, theme);
      }
    }

    // Stavový řádek.
    c.font = '500 13px system-ui, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'bottom';
    c.fillStyle = ctx.theme.textMuted;
    const seconds = Math.floor(game.elapsedMs() / 1000);
    c.fillText(
      `Tahy ${game.state.moves}   Čas ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
      20, VIEW_H - 12,
    );
    c.textAlign = 'right';
    c.fillStyle = ctx.theme.text;
    c.font = '600 15px system-ui, sans-serif';
    c.fillText(`Skóre ${game.state.score}`, VIEW_W - 20, VIEW_H - 12);

    if (game.state.won) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.8);
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      centerText(c, 'Vyšlo to!', VIEW_W / 2, VIEW_H / 2,
        '600 44px system-ui, sans-serif', theme.accent);
    }
  };

  // --- Ukazatel --------------------------------------------------------------

  // Rozlišení tapnutí od tažení se dělá vzdáleností, ne časem — herní
  // logika nesmí sahat na reálný čas (kontroluje scripts/check-determinism.mjs).
  let pressedAt: { x: number; y: number; hit: { pileId: string; index: number } } | null = null;

  const onPointerDown = (e: PointerEvent): void => {
    if (game.state.won) return;
    const local = surface.toLogical(e.clientX, e.clientY);
    const hit = cardAt(local.x, local.y);
    if (!hit) return;

    if (hit.pileId === 'zasoba') {
      if (withAnimation(() => game.draw())) ctx.audio.play('click');
      return;
    }
    if (hit.index < 0) return;

    pressedAt = { x: local.x, y: local.y, hit };
  };

  const onPointerMove = (e: PointerEvent): void => {
    const local = surface.toLogical(e.clientX, e.clientY);

    if (dragging) {
      dragging.x = local.x - dragging.offsetX;
      dragging.y = local.y - dragging.offsetY;
      return;
    }
    if (!pressedAt) return;

    // Tažení začne až po pár pixelech, aby se rozeznalo od tapnutí.
    if (Math.hypot(local.x - pressedAt.x, local.y - pressedAt.y) < 8) return;

    const { pileId, index } = pressedAt.hit;
    const pile = game.state.piles[pileId]!;
    const count = pile.cards.length - index;
    const spot = layoutOf(pileId);
    if (!spot || count <= 0) return;

    const cardY = spot.y + cardOffsetY(pile, index, spot.spread);
    dragging = {
      from: pileId,
      count,
      offsetX: pressedAt.x - spot.x,
      offsetY: pressedAt.y - cardY,
      x: local.x - (pressedAt.x - spot.x),
      y: local.y - (pressedAt.y - cardY),
    };
  };

  const onPointerUp = (e: PointerEvent): void => {
    const local = surface.toLogical(e.clientX, e.clientY);

    if (dragging) {
      const target = cardAt(dragging.x + CARD_W / 2, dragging.y + CARD_H / 2)
        ?? cardAt(local.x, local.y);
      const move = target
        ? { from: dragging.from, to: target.pileId, count: dragging.count }
        : null;
      const applied = move ? withAnimation(() => game.applyMove(move)) : false;
      ctx.audio.play(applied ? 'click' : 'error');
      dragging = null;
      pressedAt = null;
      return;
    }

    if (pressedAt) {
      // Krátké klepnutí pošle kartu na nejlepší možné místo.
      const { pileId, index } = pressedAt.hit;
      const moved = withAnimation(() => game.autoMove(pileId, index));
      ctx.audio.play(moved ? 'click' : 'tick');
      pressedAt = null;
    }
  };

  surface.canvas.addEventListener('pointerdown', onPointerDown);
  surface.canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  const loop = createLoop(
    {
      update() {
        input.sample();
        if (!finished) game.tick();
        if (hintTicks > 0) hintTicks--;

        for (const [id, anim] of anims) {
          if (--anim.ticks <= 0) anims.delete(id);
        }

        if (input.pressed('b')) {
          if (withAnimation(() => game.undo())) ctx.audio.play('tick');
        }
        if (input.pressed('x')) {
          hintMove = game.hint();
          hintTicks = hintMove ? 180 : 0;
          ctx.audio.play(hintMove ? 'click' : 'error');
        }
        if (input.pressed('a')) {
          let moved = 0;
          withAnimation(() => {
            moved = game.autoFinish();
            return moved > 0;
          });
          if (moved > 0) ctx.audio.play('levelUp');
        }

        if (game.state.score !== lastScore) {
          lastScore = game.state.score;
          ctx.emit({ type: 'score', value: lastScore });
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
      surface.canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      surface.destroy();
    },
    getSave: () => ({
      piles: Object.fromEntries(
        Object.entries(game.state.piles).map(([id, pile]) => [id, pile.cards]),
      ),
      moves: game.state.moves,
      score: game.state.score,
    }),
    loadSave(data) {
      const save = data as { piles?: Record<string, Card[]>; moves?: number; score?: number } | null;
      if (!save?.piles) return false;
      for (const [id, cards] of Object.entries(save.piles)) {
        if (game.state.piles[id]) game.state.piles[id]!.cards = cards;
      }
      game.state.moves = save.moves ?? 0;
      game.state.score = save.score ?? 0;
      return true;
    },
  };
}

/** Dole je stavový řádek a spodní řada sloupců. */
export const hintAnchor = 'vpravo-dole' as const;

export const module_: GameModule = {
  manifest, mount, renderAttract, keymap, controlHints, hintAnchor,
};
