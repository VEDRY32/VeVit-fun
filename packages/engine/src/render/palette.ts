/**
 * Jediný zdroj pravdy pro barvy celého portálu.
 *
 * Proč to leží v enginu a ne v `@vevit-games/ui`: hry v `titles/` na UI
 * balíček nezávisí (závislost jde opačným směrem), ale barvy potřebují
 * stejné. Kdyby si každá hra psala vlastní hex, rozjede se vzhled portálu
 * při první změně tokenů — přesně to se stalo před přechodem na tuhle
 * paletu. `@vevit-games/ui` proto paletu jen přebaluje do design tokenů
 * a `packages/ui/src/styles/tokens.css` ji zrcadlí do CSS proměnných.
 * Shodu hlídá test `packages/ui/src/__tests__/tokeny.test.ts`.
 */

import type { GameCategory } from '../types';

/** Barvy rozhraní. */
export const paleta = {
  /** Pozadí stránky i herní plochy. */
  noc: '#08090C',
  /** Povrch karet, panelů a herních polí. */
  pult: '#111318',
  /** Povrch při najetí myší nebo o stupeň výš. */
  pultSvetly: '#181B21',
  /** Linky a okraje. */
  linka: '#272A30',
  linkaSvetla: '#3F444D',
  text: '#FFFFFF',
  textTlumeny: '#A1A1AA',
  textPotichu: '#71717A',
  /** Primární barva značky. */
  zelena: '#10B981',
  zelenaTmava: '#059669',
  zelenaTmavsi: '#047857',
  /** Sekundární barva značky. */
  oranzova: '#F97316',
  oranzovaTmava: '#EA580C',
  oranzovaTmavsi: '#C2410C',
  uspech: '#22C55E',
  chyba: '#EF4444',
  varovani: '#F59E0B',
  neaktivni: '#52525B',
} as const;

/** Barvy kategorií; drží kontrast ≥ 4,5:1 proti `paleta.noc`. */
export const paletaKategorii: Record<GameCategory, string> = {
  logika: '#818CF8',
  arkady: paleta.oranzova,
  akce: '#F43F5E',
  spolu: '#22D3EE',
  karty: '#A78BFA',
  original: paleta.zelena,
};

/**
 * Herní paleta — odstíny, ze kterých si hry berou barvy pro vlastní grafiku.
 * Barevné tóny drží kontrast ≥ 4,5:1 proti `paleta.noc`, aby na téměř černém
 * pozadí zůstaly čitelné. Výjimkou jsou `kamen*`, které jsou naopak určené
 * jako podklad pod ně — na text se použít nesmí.
 */
export const herniPaleta = {
  modra: '#60A5FA',
  indigo: '#818CF8',
  fialova: '#A78BFA',
  ruzova: '#F472B6',
  cervena: '#F43F5E',
  oranzova: '#F97316',
  zluta: '#FBBF24',
  limetka: '#A3E635',
  zelena: '#34D399',
  tyrkys: '#22D3EE',
  hneda: '#B08968',
  /** Tlumené odstíny pro pozadí herních polí. */
  kamen: '#3F444D',
  kamenTmavy: '#272A30',
} as const;

export type PaletaKlic = keyof typeof paleta;
export type HerniPaletaKlic = keyof typeof herniPaleta;
