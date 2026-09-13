/** Vykreslení karet. Vlastní design s velkými indexy, čitelnými i na mobilu. */

import { paleta, herniPaleta, roundRect, withAlpha, centerText } from '@vevit-games/engine';
import {
  SUIT_SYMBOLS, RANK_LABELS, isRed,
  type Card, type Pile,
} from '@vevit-games/rules/pasiansy';

export const VIEW_W = 900;
export const VIEW_H = 640;
export const CARD_W = 92;
export const CARD_H = 130;
/** Rozestup odkrytých karet ve sloupci; zakryté leží těsněji. */
export const STACK_FACE_UP = 30;
export const STACK_FACE_DOWN = 13;
/** Tloušťka jedné vrstvy u hromádky, která se nerozkládá (zásoba, cíle). */
export const DECK_LAYER = 1.5;
/** Víc vrstev už jen zašumí, výš se balíček nezvedá. */
export const DECK_MAX_LAYERS = 6;

/* Líc karty je světlý, proto na něm musí být inkoust tmavý — herní paleta
   je laděná na tmavé pozadí, tyhle dvě barvy proto vznikají tady. */
const RED = '#C2333F';
const BLACK = '#14161A';
const FACE = paleta.text;

export interface CardTheme {
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  colorblind: boolean;
}

export function drawCard(
  ctx: CanvasRenderingContext2D,
  card: Card, x: number, y: number, theme: CardTheme, highlighted = false,
): void {
  if (!card.faceUp) {
    // Rub: tmavě modrý pult s jemným motivem VeVit.
    ctx.fillStyle = paleta.linka;
    roundRect(ctx, x, y, CARD_W, CARD_H, 9);
    ctx.fill();
    ctx.strokeStyle = withAlpha('#ffffff', 0.12);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = withAlpha(theme.accent, 0.5);
    const size = 11;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      roundRect(ctx, x + CARD_W / 2 + dx * 13 - size / 2, y + CARD_H / 2 + dy * 13 - size / 2, size, size, 3);
      ctx.fill();
    }
    return;
  }

  ctx.fillStyle = FACE;
  roundRect(ctx, x, y, CARD_W, CARD_H, 9);
  ctx.fill();
  ctx.strokeStyle = highlighted ? theme.accent : withAlpha('#000000', 0.18);
  ctx.lineWidth = highlighted ? 2.5 : 1;
  ctx.stroke();

  const color = isRed(card.suit) ? RED : BLACK;
  ctx.fillStyle = color;

  // Velký index v rohu — jediné, co musí být na mobilu čitelné ze sloupce.
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(RANK_LABELS[card.rank], x + 8, y + 6);

  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText(SUIT_SYMBOLS[card.suit], x + 8, y + 34);

  // Velký symbol uprostřed; v colorblind režimu doplněný písmenem barvy.
  ctx.font = '600 42px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(SUIT_SYMBOLS[card.suit], x + CARD_W / 2 + 12, y + CARD_H - 40);

  if (theme.colorblind) {
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(isRed(card.suit) ? 'Č' : 'K', x + CARD_W - 8, y + 8);
  }
}

/** Prázdné místo hromádky — obrys s náznakem, co sem patří. */
export function drawSlot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, theme: CardTheme, hint?: string,
): void {
  ctx.strokeStyle = withAlpha(theme.text, 0.18);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  roundRect(ctx, x, y, CARD_W, CARD_H, 9);
  ctx.stroke();
  ctx.setLineDash([]);
  if (hint) {
    centerText(ctx, hint, x + CARD_W / 2, y + CARD_H / 2,
      '600 28px system-ui, sans-serif', withAlpha(theme.text, 0.2));
  }
}

export interface PileLayout {
  id: string;
  x: number;
  y: number;
  /** Svislý rozestup karet; 0 = všechny na sobě. */
  spread: number;
}

/** Rozmístění hromádek podle varianty. */
export function layoutFor(variant: 'klondike' | 'pavouk' | 'freecell'): PileLayout[] {
  const layouts: PileLayout[] = [];
  const gap = 14;
  const topY = 24;
  const columnY = topY + CARD_H + 26;

  if (variant === 'klondike') {
    const startX = (VIEW_W - (7 * CARD_W + 6 * gap)) / 2;
    layouts.push({ id: 'zasoba', x: startX, y: topY, spread: 0 });
    layouts.push({ id: 'odkladani', x: startX + CARD_W + gap, y: topY, spread: 0 });
    for (let i = 0; i < 4; i++) {
      layouts.push({ id: `cil${i}`, x: startX + (3 + i) * (CARD_W + gap), y: topY, spread: 0 });
    }
    for (let i = 0; i < 7; i++) {
      layouts.push({ id: `sloupec${i}`, x: startX + i * (CARD_W + gap), y: columnY, spread: STACK_FACE_UP });
    }
    return layouts;
  }

  if (variant === 'freecell') {
    const startX = (VIEW_W - (8 * CARD_W + 7 * gap)) / 2;
    for (let i = 0; i < 4; i++) {
      layouts.push({ id: `volne${i}`, x: startX + i * (CARD_W + gap), y: topY, spread: 0 });
    }
    for (let i = 0; i < 4; i++) {
      layouts.push({ id: `cil${i}`, x: startX + (4 + i) * (CARD_W + gap), y: topY, spread: 0 });
    }
    for (let i = 0; i < 8; i++) {
      layouts.push({ id: `sloupec${i}`, x: startX + i * (CARD_W + gap), y: columnY, spread: STACK_FACE_UP });
    }
    return layouts;
  }

  // Pavouk: deset sloupců je na šířku nejtěsnější, karty se překrývají víc.
  const spiderGap = 6;
  const spiderW = (VIEW_W - 40 - 9 * spiderGap) / 10;
  const scale = spiderW / CARD_W;
  const startX = 20;
  layouts.push({ id: 'zasoba', x: VIEW_W - CARD_W - 20, y: topY, spread: 0 });
  for (let i = 0; i < 8; i++) {
    layouts.push({ id: `cil${i}`, x: startX + i * (spiderW + spiderGap) * scale, y: topY, spread: 0 });
  }
  for (let i = 0; i < 10; i++) {
    layouts.push({ id: `sloupec${i}`, x: startX + i * (spiderW + spiderGap), y: columnY, spread: 22 });
  }
  return layouts;
}

/** Svislá pozice karty ve sloupci — zakryté karty leží těsněji. */
export function cardOffsetY(pile: Pile, index: number, spread: number): number {
  /*
   * Hromádka bez rozkladu (`spread === 0`) je balíček, ne sloupec. Dřív se
   * i tady každá rubová karta odsadila o STACK_FACE_DOWN, takže zásoba
   * o dvaceti čtyřech kartách sahala přes tři sta pixelů dolů a protínala
   * sloupce pod sebou. Teď se jen mírně zvedá jako opravdový balíček.
   */
  if (spread === 0) return -Math.min(index, DECK_MAX_LAYERS) * DECK_LAYER;

  let offset = 0;
  for (let i = 0; i < index; i++) {
    offset += pile.cards[i]!.faceUp ? spread : STACK_FACE_DOWN;
  }
  return offset;
}
