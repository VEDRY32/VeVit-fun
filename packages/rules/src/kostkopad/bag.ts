/**
 * Generátor tvarů „sedm v pytli".
 *
 * Každá sedmice obsahuje všech sedm tvarů v náhodném pořadí. Hráč tak nikdy
 * nečeká na tvar I donekonečna a zároveň si nemůže být jistý pořadím.
 */

import type { Rng } from '@vevit-games/engine/core';
import { PIECE_TYPES, type PieceType } from './pieces.js';

export interface PieceQueue {
  /** Vytáhne další tvar. */
  next(): PieceType;
  /** Náhled prvních `count` tvarů, aniž by se spotřebovaly. */
  peek(count: number): PieceType[];
}

export function createPieceQueue(rng: Rng): PieceQueue {
  const queue: PieceType[] = [];

  const refill = (): void => {
    queue.push(...rng.shuffle(PIECE_TYPES));
  };

  const ensure = (count: number): void => {
    while (queue.length < count) refill();
  };

  ensure(7);

  return {
    next() {
      ensure(8);
      return queue.shift()!;
    },
    peek(count) {
      ensure(count + 1);
      return queue.slice(0, count);
    },
  };
}
