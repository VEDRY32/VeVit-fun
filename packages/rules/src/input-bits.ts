/**
 * Sémantické vstupy odvozené z bitové masky akcí.
 *
 * `rules` nesmí znát klávesy — jen abstraktní akce z enginu. Pořadí akcí
 * v `ACTIONS` je součástí formátu replaye, takže se nesmí měnit bez zvýšení
 * verze replaye.
 */

import { ACTIONS, type Action } from '@vevit-games/engine';

export const bitOf = (action: Action): number => 1 << ACTIONS.indexOf(action);

export const BIT = {
  left: bitOf('left'),
  right: bitOf('right'),
  up: bitOf('up'),
  down: bitOf('down'),
  a: bitOf('a'),
  b: bitOf('b'),
  x: bitOf('x'),
  y: bitOf('y'),
  l: bitOf('l'),
  r: bitOf('r'),
  start: bitOf('start'),
} as const;

/** Hrana stisku: akce je držená teď a nebyla v předchozím kroku. */
export const justPressed = (current: number, previous: number, bit: number): boolean =>
  (current & bit) !== 0 && (previous & bit) === 0;

export const isHeld = (mask: number, bit: number): boolean => (mask & bit) !== 0;
