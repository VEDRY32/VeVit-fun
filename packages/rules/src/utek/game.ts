/**
 * Útěk — běh třemi pruhy s pronásledovatelem v zádech.
 *
 * Liší se od Běžce záměrně: tam se skáče přes překážky v jedné dráze, tady
 * se uhýbá mezi pruhy a hlavní tlak dělá pronásledovatel. Každý náraz ho
 * pustí blíž, čistý běh ho zase odsune. Konec přijde, až hráče dožene.
 *
 * Vše jede ze seedu, takže server umí běh přehrát (D-008).
 */

import { createRng, type Rng } from '@vevit-games/engine/core';
import { BIT, justPressed } from '../input-bits.js';

export const UTEK_RULES_VERSION = 1;

export const LANES = 3;
export const WORLD_W = 720;
export const WORLD_H = 360;
/** Svislý střed pruhu. */
export const LANE_Y = [130, 210, 290];

export const RUNNER_X = 150;
export const RUNNER_W = 26;
export const RUNNER_H = 38;

export type ObstacleKind = 'bedna' | 'zavora' | 'dira';

export interface Obstacle {
  kind: ObstacleKind;
  lane: number;
  x: number;
  w: number;
  /** Překážka, kterou hráč mine bez nárazu, přidá bod. */
  passed: boolean;
}

export interface Pickup {
  lane: number;
  x: number;
  taken: boolean;
}

export interface UtekState {
  lane: number;
  /** Plynulá svislá poloha; přeskok mezi pruhy chvíli trvá. */
  y: number;
  /** Výška skoku nad pruhem; 0 = na zemi. */
  hop: number;
  hopVelocity: number;
  speed: number;
  distance: number;
  obstacles: Obstacle[];
  pickups: Pickup[];
  /** Jak blízko je pronásledovatel, 0–1. Na jedničce hra končí. */
  chase: number;
  /** Krátká nezranitelnost po nárazu. */
  hitTicks: number;
  score: number;
  tick: number;
  nextSpawn: number;
  over: boolean;
  previousMask: number;
}

export interface UtekGame {
  readonly state: UtekState;
  readonly rulesVersion: number;
  step(mask: number): void;
  /** Obdélník běžce v souřadnicích světa. */
  runnerRect(): { x: number; y: number; w: number; h: number };
}

const START_SPEED = 4.2;
const MAX_SPEED = 11;
const SPEED_GAIN = 0.0016;
/** O kolik se pronásledovatel přiblíží při nárazu. */
const CHASE_ON_HIT = 0.3;
/** Jak rychle couvá při čistém běhu. */
const CHASE_RECOVER = 0.00055;
const HIT_TICKS = 45;
const LANE_SPEED = 9;
const HOP_VELOCITY = -8.6;
const HOP_GRAVITY = 0.62;

export function createUtek(seed: string): UtekGame {
  const rng: Rng = createRng(seed);

  const state: UtekState = {
    lane: 1,
    y: LANE_Y[1]!,
    hop: 0,
    hopVelocity: 0,
    speed: START_SPEED,
    distance: 0,
    obstacles: [],
    pickups: [],
    chase: 0.25,
    hitTicks: 0,
    score: 0,
    tick: 0,
    nextSpawn: 55,
    over: false,
    previousMask: 0,
  };

  const runnerRect = (): { x: number; y: number; w: number; h: number } => ({
    x: RUNNER_X,
    y: state.y - RUNNER_H / 2 - state.hop,
    w: RUNNER_W,
    h: RUNNER_H,
  });

  /**
   * Rozestavení další vlny. Vždycky zůstane aspoň jeden pruh volný —
   * bez toho by se vlna nedala projet a hra by byla nefér.
   */
  const spawnWave = (): void => {
    const blocked = rng.int(1, LANES); // 1 nebo 2 pruhy
    const lanes = [0, 1, 2];
    // Deterministické promíchání: vybíráme bez opakování podle seedu.
    const chosen: number[] = [];
    for (let i = 0; i < blocked; i++) {
      const pick = rng.int(0, lanes.length);
      chosen.push(lanes.splice(pick, 1)[0]!);
    }

    for (const lane of chosen) {
      const roll = rng.int(0, 3);
      const kind: ObstacleKind = roll === 0 ? 'zavora' : roll === 1 ? 'dira' : 'bedna';
      state.obstacles.push({
        kind, lane, x: WORLD_W + 40,
        w: kind === 'zavora' ? 24 : kind === 'dira' ? 70 : 36,
        passed: false,
      });
    }

    // Do volného pruhu občas spadne odměna.
    const free = lanes[0];
    if (free != null && rng.chance(0.55)) {
      state.pickups.push({ lane: free, x: WORLD_W + 60, taken: false });
    }

    // Rozestup měříme v pixelech, ne v krocích: jinak by se s rostoucí
    // rychlostí vlny slily k sobě. Na obrazovku se vejdou zhruba dvě.
    const gapPixels = 420 + rng.int(0, 160);
    state.nextSpawn = Math.max(24, Math.round(gapPixels / state.speed));
  };

  const hits = (obstacle: Obstacle): boolean => {
    if (obstacle.lane !== state.lane) return false;
    const r = runnerRect();
    if (r.x + r.w < obstacle.x || r.x > obstacle.x + obstacle.w) return false;
    // Závoru i bednu lze přeskočit, díru jen přeletět — ta je širší.
    if (obstacle.kind === 'dira') return state.hop < 16;
    return state.hop < 26;
  };

  return {
    state,
    rulesVersion: UTEK_RULES_VERSION,
    runnerRect,

    step(mask) {
      const previous = state.previousMask;
      state.previousMask = mask;
      if (state.over) return;
      state.tick++;

      // --- Vstup ---
      if (justPressed(mask, previous, BIT.up) && state.lane > 0) state.lane--;
      if (justPressed(mask, previous, BIT.down) && state.lane < LANES - 1) state.lane++;
      const jump = justPressed(mask, previous, BIT.a) || justPressed(mask, previous, BIT.pointer);
      if (jump && state.hop === 0) state.hopVelocity = HOP_VELOCITY;

      // --- Pohyb ---
      const targetY = LANE_Y[state.lane]!;
      const dy = targetY - state.y;
      state.y += Math.abs(dy) <= LANE_SPEED ? dy : Math.sign(dy) * LANE_SPEED;

      if (state.hopVelocity !== 0 || state.hop > 0) {
        state.hop -= state.hopVelocity;
        state.hopVelocity += HOP_GRAVITY;
        if (state.hop <= 0) {
          state.hop = 0;
          state.hopVelocity = 0;
        }
      }

      state.speed = Math.min(MAX_SPEED, state.speed + SPEED_GAIN);
      state.distance += state.speed;
      state.score = Math.floor(state.distance / 10);

      if (state.hitTicks > 0) state.hitTicks--;

      // --- Svět ---
      if (--state.nextSpawn <= 0) spawnWave();

      for (const obstacle of state.obstacles) obstacle.x -= state.speed;
      for (const pickup of state.pickups) pickup.x -= state.speed;

      for (const obstacle of state.obstacles) {
        if (obstacle.passed) continue;
        if (obstacle.x + obstacle.w < RUNNER_X) {
          obstacle.passed = true;
          state.score += 25;
          continue;
        }
        if (state.hitTicks === 0 && hits(obstacle)) {
          state.hitTicks = HIT_TICKS;
          state.chase = Math.min(1, state.chase + CHASE_ON_HIT);
          // Náraz sebere tempo; zrychlovat se musí znovu.
          state.speed = Math.max(START_SPEED, state.speed * 0.72);
        }
      }

      for (const pickup of state.pickups) {
        if (pickup.taken || pickup.lane !== state.lane) continue;
        if (Math.abs(pickup.x - RUNNER_X) < 26) {
          pickup.taken = true;
          state.score += 150;
          state.chase = Math.max(0, state.chase - 0.08);
        }
      }

      state.obstacles = state.obstacles.filter((o) => o.x + o.w > -60);
      state.pickups = state.pickups.filter((p) => !p.taken && p.x > -60);

      // Pronásledovatel couvá jen tehdy, když hráč opravdu běží.
      if (state.hitTicks === 0) state.chase = Math.max(0, state.chase - CHASE_RECOVER);
      if (state.chase >= 1) state.over = true;
    },
  };
}
