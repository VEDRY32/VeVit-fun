/**
 * Sdílená část balíčku @vevit-games/rules.
 *
 * Pravidla jednotlivých her sem **nepatří**: při padesáti hrách by se
 * jejich konstanty (FIELD_W, COLS, Cell…) nevyhnutelně srazily. Každá hra
 * má vlastní vstup `@vevit-games/rules/<slug>`.
 */

export * from './input-bits.js';
export * from './validate.js';
