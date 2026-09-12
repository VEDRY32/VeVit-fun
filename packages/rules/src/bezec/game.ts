/**
 * Běžec — nekonečný běh se skokem a přikrčením.
 *
 * Fixed-point (D-010): hra má hodnocený žebříček a denní seed, takže
 * server musí umět běh přehrát. Zároveň slouží jako offline stránka
 * portálu, kde musí fungovat úplně bez sítě.
 */

import {
  createRng, fx, fxAdd, fxMul, toFloat, type Fx, type Rng,
} from '@vevit-games/engine/core';
import { BIT, justPressed, isHeld } from '../input-bits.js';

export const BEZEC_RULES_VERSION = 2;

export const WORLD_W = 640;
export const WORLD_H = 240;
export const GROUND_Y = 200;

const FOX_X = fx(70);
const FOX_W = fx(38);
const FOX_H_STAND = fx(40);
const FOX_H_DUCK = fx(22);

const GRAVITY = fx(0.62);
const JUMP_VELOCITY = fx(-10.6);
/** Držené tlačítko skoku prodlouží stoupání — skok jde dávkovat. */
const JUMP_HOLD_BOOST = fx(-0.34);
const MAX_HOLD_TICKS = 12;

const START_SPEED = fx(4.6);
const MAX_SPEED = fx(11);
/** Přírůstek rychlosti za krok; po ~2 minutách se dojede na strop. */
const SPEED_GAIN = fx(0.00055);

export type ObstacleKind =
  | 'ker-maly' | 'ker-velky' | 'ker-trojity'
  | 'pták-nizko' | 'pták-vysoko'
  | 'kamen' | 'plot' | 'vetev';

export interface Obstacle {
  kind: ObstacleKind;
  x: Fx;
  /** Horní hrana překážky. */
  y: Fx;
  w: Fx;
  h: Fx;
}

export interface BezecState {
  y: Fx;
  velocity: Fx;
  onGround: boolean;
  ducking: boolean;
  jumpHoldTicks: number;
  speed: Fx;
  distance: Fx;
  obstacles: Obstacle[];
  /** Vzdálenost do další překážky. */
  nextGap: Fx;
  score: number;
  tick: number;
  started: boolean;
  over: boolean;
  /** 0 = den, 1 = noc; mění se plynule. */
  night: number;
  previousMask: number;
}

export interface BezecGame {
  readonly state: BezecState;
  readonly rulesVersion: number;
  step(mask: number): void;
  /** Obdélník lišky pro vykreslení a testy. */
  foxRect(): { x: number; y: number; w: number; h: number };
  obstacleRects(): { kind: ObstacleKind; x: number; y: number; w: number; h: number }[];
}

/** Rozměry překážek. Ptáci létají ve dvou výškách — nízko se podleze. */
const SHAPES: Record<ObstacleKind, { w: number; h: number; y: number }> = {
  'ker-maly': { w: 20, h: 30, y: GROUND_Y - 30 },
  'ker-velky': { w: 28, h: 44, y: GROUND_Y - 44 },
  'ker-trojity': { w: 58, h: 34, y: GROUND_Y - 34 },
  'pták-nizko': { w: 34, h: 22, y: GROUND_Y - 62 },
  'pták-vysoko': { w: 34, h: 22, y: GROUND_Y - 96 },
  // Nízký široký kámen: přeskočit jde snadno, ale zabere kus dráhy.
  kamen: { w: 42, h: 16, y: GROUND_Y - 16 },
  // Úzký vysoký plot: skok musí sedět načasováním, ne délkou.
  plot: { w: 12, h: 54, y: GROUND_Y - 54 },
  // Převislá větev: jediná překážka, která se dá jen podběhnout.
  vetev: { w: 52, h: 30, y: GROUND_Y - 66 },
};

/**
 * Hra odpouští pár pixelů na každé straně lišky.
 * Bez toho končila hra i při dotyku, který na obrazovce nebyl vidět —
 * kresba lišky je užší než její obdélník.
 */
const HITBOX_INSET_X = fx(4);
const HITBOX_INSET_Y = fx(3);

export function createBezec(seed: string): BezecGame {
  const rng: Rng = createRng(seed);

  const state: BezecState = {
    y: fx(GROUND_Y),
    velocity: 0,
    onGround: true,
    ducking: false,
    jumpHoldTicks: 0,
    speed: START_SPEED,
    distance: 0,
    obstacles: [],
    nextGap: fx(320),
    score: 0,
    tick: 0,
    started: false,
    over: false,
    night: 0,
    previousMask: 0,
  };

  const foxHeight = (): Fx => (state.ducking && state.onGround ? FOX_H_DUCK : FOX_H_STAND);

  const spawnObstacle = (): void => {
    // Ptáci se objeví, až když hra nabere tempo — jinak je hráč nestihne.
    const pool: ObstacleKind[] = toFloat(state.speed) > 6
      ? ['ker-maly', 'ker-velky', 'ker-trojity', 'kamen', 'plot', 'vetev', 'pták-nizko', 'pták-vysoko']
      : ['ker-maly', 'ker-velky', 'ker-trojity', 'kamen', 'plot'];
    const kind = rng.pick(pool);
    const shape = SHAPES[kind];
    state.obstacles.push({
      kind,
      x: fx(WORLD_W + 40),
      y: fx(shape.y),
      w: fx(shape.w),
      h: fx(shape.h),
    });

    // Mezera roste s rychlostí, aby zůstala projitelná.
    const speed = toFloat(state.speed);
    const min = 170 + speed * 18;
    state.nextGap = fx(min + rng.int(0, Math.round(120 + speed * 12)));
  };

  const collides = (): boolean => {
    const top = fxAdd(state.y - foxHeight(), HITBOX_INSET_Y);
    const bottom = state.y - HITBOX_INSET_Y;
    const left = fxAdd(FOX_X, HITBOX_INSET_X);
    const right = fxAdd(FOX_X, FOX_W) - HITBOX_INSET_X;

    for (const obstacle of state.obstacles) {
      const oLeft = obstacle.x;
      const oRight = fxAdd(obstacle.x, obstacle.w);
      if (right < oLeft || left > oRight) continue;
      const oTop = obstacle.y;
      const oBottom = fxAdd(obstacle.y, obstacle.h);
      if (bottom < oTop || top > oBottom) continue;
      return true;
    }
    return false;
  };

  return {
    state,
    rulesVersion: BEZEC_RULES_VERSION,

    foxRect() {
      const height = toFloat(foxHeight());
      return {
        x: toFloat(FOX_X),
        y: toFloat(state.y) - height,
        w: toFloat(FOX_W),
        h: height,
      };
    },

    obstacleRects: () => state.obstacles.map((o) => ({
      kind: o.kind,
      x: toFloat(o.x),
      y: toFloat(o.y),
      w: toFloat(o.w),
      h: toFloat(o.h),
    })),

    step(mask) {
      const previous = state.previousMask;
      state.previousMask = mask;
      if (state.over) return;

      const jumpPressed = justPressed(mask, previous, BIT.a)
        || justPressed(mask, previous, BIT.up)
        || justPressed(mask, previous, BIT.pointer);
      const jumpHeld = isHeld(mask, BIT.a) || isHeld(mask, BIT.up) || isHeld(mask, BIT.pointer);

      // Dokud hráč poprvé neskočí, liška stojí a čeká.
      if (!state.started) {
        if (!jumpPressed) return;
        state.started = true;
      }

      state.tick++;

      // --- Skok a přikrčení ---
      state.ducking = isHeld(mask, BIT.down);

      if (jumpPressed && state.onGround) {
        state.velocity = JUMP_VELOCITY;
        state.onGround = false;
        state.jumpHoldTicks = 0;
      }
      if (!state.onGround && jumpHeld && state.jumpHoldTicks < MAX_HOLD_TICKS && state.velocity < 0) {
        state.velocity = fxAdd(state.velocity, JUMP_HOLD_BOOST);
        state.jumpHoldTicks++;
      }
      // Přikrčení ve vzduchu sráží lišku rychleji dolů.
      const gravity = state.ducking && !state.onGround ? fxMul(GRAVITY, fx(2.2)) : GRAVITY;
      state.velocity = fxAdd(state.velocity, gravity);
      state.y = fxAdd(state.y, state.velocity);

      if (state.y >= fx(GROUND_Y)) {
        state.y = fx(GROUND_Y);
        state.velocity = 0;
        state.onGround = true;
      }

      // --- Svět ---
      if (state.speed < MAX_SPEED) state.speed = fxAdd(state.speed, SPEED_GAIN);
      state.distance = fxAdd(state.distance, state.speed);
      state.score = Math.floor(toFloat(state.distance) / 10);

      for (const obstacle of state.obstacles) {
        obstacle.x = obstacle.x - state.speed;
      }
      state.obstacles = state.obstacles.filter((o) => fxAdd(o.x, o.w) > fx(-20));

      state.nextGap = state.nextGap - state.speed;
      if (state.nextGap <= 0) spawnObstacle();

      // Cyklus dne a noci: plných 700 bodů na jedno otočení.
      const cycle = (state.score % 1400) / 700;
      state.night = cycle <= 1 ? cycle : 2 - cycle;

      if (collides()) state.over = true;
    },
  };
}

export { SHAPES as OBSTACLE_SHAPES };
