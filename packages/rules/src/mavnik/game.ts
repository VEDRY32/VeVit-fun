/**
 * Mávník — jedno tlačítko, gravitace, mezery mezi překážkami.
 *
 * Celá logika běží ve fixed-point (D-010): hra má denní seed a hodnocený
 * žebříček, takže server musí umět běh přehrát na bit přesně.
 */

import {
  createRng, fx, fxAdd, fxSub, fxMul, fxAbs, fxClamp, fxFloor, toFloat,
  type Fx, type Rng,
} from '@vevit-games/engine/core';
import { BIT, justPressed } from '../input-bits.js';

export const MAVNIK_RULES_VERSION = 2;

export const WORLD_W = 400;
export const WORLD_H = 600;

/** Zrychlení a rychlost mávnutí; hodnoty jsou v Q16.16 na krok. */
const GRAVITY = fx(0.42);
const FLAP_VELOCITY = fx(-7.2);
const MAX_FALL = fx(11);

export const BIRD_X = fx(110);
export const BIRD_RADIUS = fx(13);

const PIPE_WIDTH = fx(58);
const PIPE_SPACING = fx(190);
const SCROLL_SPEED = fx(2.6);
/** Mezera se s rostoucím skóre zužuje, ale ne pod tuhle mez. */
const GAP_START = fx(175);
const GAP_MIN = fx(120);
const GAP_STEP = fx(2.5);

export interface Pipe {
  x: Fx;
  /** Svislý střed mezery. */
  gapCenter: Fx;
  gap: Fx;
  /** Hráč už tuhle překážku minul a má za ni bod. */
  scored: boolean;
}

export type MavnikMode = 'klasik' | 'denni';

export interface MavnikState {
  y: Fx;
  velocity: Fx;
  /** Náklon draka podle rychlosti — jen pro vykreslení. */
  rotation: number;
  pipes: Pipe[];
  score: number;
  tick: number;
  started: boolean;
  over: boolean;
  previousMask: number;
}

export interface MavnikGame {
  readonly state: MavnikState;
  readonly rulesVersion: number;
  step(mask: number): void;
  /** Souřadnice pro vykreslení v pixelech. */
  birdY(): number;
  pipeRects(): { x: number; y: number; w: number; h: number }[];
  /** Medaile podle skóre — bronz 10, stříbro 25, zlato 50. */
  medal(): 'zadna' | 'bronz' | 'stribro' | 'zlato';
  /**
   * Naráží drak právě teď? Stejná funkce, jakou používá `step`.
   * Je součástí rozhraní, aby šla geometrie nárazu ověřit testem přímo,
   * bez obcházení přes celý krok hry.
   */
  collides(): boolean;
}

export function createMavnik(seed: string, mode: MavnikMode = 'klasik'): MavnikGame {
  const rng: Rng = createRng(seed);

  const state: MavnikState = {
    y: fx(WORLD_H / 2),
    velocity: 0,
    rotation: 0,
    pipes: [],
    score: 0,
    tick: 0,
    started: false,
    over: false,
    previousMask: 0,
  };

  const gapFor = (score: number): Fx => {
    const shrunk = fx(toFloat(GAP_START) - score * toFloat(GAP_STEP));
    return shrunk < GAP_MIN ? GAP_MIN : shrunk;
  };

  const spawnPipe = (x: Fx): void => {
    const gap = gapFor(state.score);
    const margin = fxAdd(fxMul(gap, fx(0.5)), fx(60));
    const min = margin;
    const max = fx(WORLD_H) - margin;
    // rng.int pracuje v celých číslech; na pixely to stačí.
    const center = fx(rng.int(fxFloor(min), fxFloor(max)));
    state.pipes.push({ x, gapCenter: center, gap, scored: false });
  };

  // Tři překážky dopředu, aby hráč viděl, co ho čeká.
  for (let i = 0; i < 3; i++) {
    spawnPipe(fxAdd(fx(WORLD_W + 60), fxMul(PIPE_SPACING, fx(i))));
  }

  /**
   * Kruh proti obdélníku, celé ve fixed-pointu.
   *
   * Dřív se místo kruhu porovnával jeho opsaný čtverec, takže hra hlásila
   * náraz i tehdy, když se roh čtverce minul se stavbou o několik pixelů —
   * hráč viděl volný průlet a přesto prohrál. Nejbližší bod obdélníku je
   * od středu nanejvýš o poloměr, takže druhé mocniny zůstávají malé
   * a v Q16.16 se nepřetečou.
   */
  const circleHitsRect = (
    cx: Fx, cy: Fx, radius: Fx,
    left: Fx, right: Fx, top: Fx, bottom: Fx,
  ): boolean => {
    const dx = fxSub(cx, fxClamp(cx, left, right));
    const dy = fxSub(cy, fxClamp(cy, top, bottom));
    if (fxAbs(dx) > radius || fxAbs(dy) > radius) return false;
    return fxAdd(fxMul(dx, dx), fxMul(dy, dy)) <= fxMul(radius, radius);
  };

  const collides = (): boolean => {
    const y = state.y;
    // Zem zabíjí. Strop ne — o něj se drak jen zarazí (řeší `step`),
    // protože smrt nahoře působí jako chyba, ne jako překážka.
    if (fxAdd(y, BIRD_RADIUS) >= fx(WORLD_H)) return true;

    for (const pipe of state.pipes) {
      const left = pipe.x;
      const right = fxAdd(pipe.x, PIPE_WIDTH);
      if (fxAdd(BIRD_X, BIRD_RADIUS) < left || fxSub(BIRD_X, BIRD_RADIUS) > right) continue;

      const half = fxMul(pipe.gap, fx(0.5));
      const gapTop = fxSub(pipe.gapCenter, half);
      const gapBottom = fxAdd(pipe.gapCenter, half);

      // Horní i dolní stavba zvlášť; mezi nimi je průlet.
      if (circleHitsRect(BIRD_X, y, BIRD_RADIUS, left, right, 0, gapTop)) return true;
      if (circleHitsRect(BIRD_X, y, BIRD_RADIUS, left, right, gapBottom, fx(WORLD_H))) return true;
    }
    return false;
  };

  return {
    state,
    rulesVersion: MAVNIK_RULES_VERSION,

    step(mask) {
      const previous = state.previousMask;
      state.previousMask = mask;
      if (state.over) return;

      // Mávnout jde mezerníkem, šipkou nahoru i tapnutím kamkoliv.
      const flap = justPressed(mask, previous, BIT.a)
        || justPressed(mask, previous, BIT.up)
        || justPressed(mask, previous, BIT.pointer);

      // Dokud hráč nemávne poprvé, drak jen čeká — nespadne dřív, než začne hrát.
      if (!state.started) {
        if (!flap) return;
        state.started = true;
      }

      state.tick++;

      if (flap) state.velocity = FLAP_VELOCITY;
      state.velocity = fxAdd(state.velocity, GRAVITY);
      if (state.velocity > MAX_FALL) state.velocity = MAX_FALL;
      state.y = fxAdd(state.y, state.velocity);
      // U stropu se drak zarazí. Smrt nahoře působila jako chyba hry.
      if (fxSub(state.y, BIRD_RADIUS) < 0) {
        state.y = BIRD_RADIUS;
        if (state.velocity < 0) state.velocity = 0;
      }

      state.rotation = Math.max(-0.5, Math.min(1.3, toFloat(state.velocity) * 0.09));

      for (const pipe of state.pipes) {
        pipe.x = pipe.x - SCROLL_SPEED;
        if (!pipe.scored && fxAdd(pipe.x, PIPE_WIDTH) < BIRD_X) {
          pipe.scored = true;
          state.score++;
        }
      }

      // Překážku za okrajem nahradí nová na konci řady.
      if (state.pipes.length > 0 && fxAdd(state.pipes[0]!.x, PIPE_WIDTH) < 0) {
        state.pipes.shift();
        const last = state.pipes[state.pipes.length - 1];
        spawnPipe(fxAdd(last ? last.x : fx(WORLD_W), PIPE_SPACING));
      }

      if (collides()) state.over = true;
    },

    collides,
    birdY: () => toFloat(state.y),

    pipeRects() {
      const rects: { x: number; y: number; w: number; h: number }[] = [];
      for (const pipe of state.pipes) {
        const half = toFloat(fxMul(pipe.gap, fx(0.5)));
        const center = toFloat(pipe.gapCenter);
        const x = toFloat(pipe.x);
        const w = toFloat(PIPE_WIDTH);
        rects.push({ x, y: 0, w, h: center - half });
        rects.push({ x, y: center + half, w, h: WORLD_H - (center + half) });
      }
      return rects;
    },

    medal() {
      if (state.score >= 50) return 'zlato';
      if (state.score >= 25) return 'stribro';
      if (state.score >= 10) return 'bronz';
      return 'zadna';
    },
  };
}

export { type MavnikMode as MavnikModeType };
