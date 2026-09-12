/**
 * Kuličkodráha — kulička běžící po procedurálně generované dráze s mezerami.
 *
 * Technika projekce (v `titles/kulickodraha/src/render.ts`) a algoritmus
 * generování dráhy vycházejí z veřejně publikovaného dema „Skydreams"
 * (Frank Force, JS1024 2026) — viz THIRD_PARTY.md a DECISIONS.md D-019.
 * Skoková fyzika je vlastní diskrétní impuls s držením pro výšku, ne
 * doslovný přepis originálu.
 *
 * Vše jede ze seedu přes `createRng`, takže server umí běh přehrát (D-008).
 */

import { createRng, type Rng } from '@vevit-games/engine/core';
import { BIT, justPressed, isHeld } from '../input-bits.js';

export const KULICKODRAHA_RULES_VERSION = 1;

export const TRACK_COLS = 7;
/** Kolik řádků před hráčem je dlaždice, na kterou právě dopadá. */
export const CAMERA_LOOKAHEAD = 3;
/** Kolik řádků dráhy udržovat vygenerovaných dopředu — dost na vykreslení do dálky. */
export const ROWS_AHEAD = 45;
/** Pod touto výškou kulička spadla z dráhy — konec hry. */
export const DEATH_Y = -4;

const START_SPEED = 0.2;
const MAX_SPEED = 0.5;
const SPEED_GAIN_DIVISOR = 5000;
const SCORE_PER_Z = 10;

const STEER_SPEED = 0.1;
const MIN_X = -2;
const MAX_X = TRACK_COLS + 1;

const JUMP_VELOCITY = 3.4;
const GRAVITY = 0.2;
const JUMP_HOLD_BOOST = 0.12;
const MAX_HOLD_TICKS = 12;

export interface KulickodrahaState {
  x: number;
  y: number;
  vy: number;
  onGround: boolean;
  jumpHoldTicks: number;
  z: number;
  speed: number;
  /** Vygenerované řádky dráhy; `rows[i][j]` = dlaždice na řádku `i`, sloupci `j`. */
  rows: boolean[][];
  trackGap: number;
  trackSx: number;
  trackSw: number;
  score: number;
  tick: number;
  over: boolean;
  previousMask: number;
}

export interface KulickodrahaGame {
  readonly state: KulickodrahaState;
  readonly rulesVersion: number;
  step(mask: number): void;
}

export function createKulickodraha(seed: string): KulickodrahaGame {
  const rng: Rng = createRng(seed);

  const state: KulickodrahaState = {
    x: TRACK_COLS / 2,
    y: 0,
    vy: 0,
    onGround: true,
    jumpHoldTicks: 0,
    z: 0,
    speed: START_SPEED,
    rows: [],
    trackGap: 0,
    trackSx: 3,
    trackSw: 3,
    score: 0,
    tick: 0,
    over: false,
    previousMask: 0,
  };

  /** Doplní řádky dráhy až po zadaný index — generuje se jen dopředu, nikdy zpětně. */
  const ensureRowsUpTo = (target: number): void => {
    while (state.rows.length <= target) {
      const i = state.rows.length;

      // Občas se rozhodne o nové celoplošné mezeře, ale ne dřív, než ta
      // předchozí doopravdy skončila (`trackGap < -8`).
      if (state.trackGap < -8 && rng.chance(Math.min(0.2, i / 1e4))) {
        state.trackGap = 2 + Math.min(4, i / 400);
      }
      // Pruh dráhy občas změní šířku i polohu.
      if (rng.chance(0.1)) {
        state.trackSw = 2 + rng.int(0, 3);
        state.trackSx = Math.max(0, Math.min(TRACK_COLS - state.trackSw, state.trackSx - 2 + rng.int(0, 5)));
      }
      state.trackGap--;

      const row: boolean[] = [];
      const holeChance = Math.min(0.2, i / 1e4);
      for (let j = 0; j < TRACK_COLS; j++) {
        const start = i < 35; // bezpečná zóna na startu
        const pillar = rng.chance(0.1); // sloupek mimo pruh
        const inSpan = state.trackGap < 0 && state.trackSx <= j && j < state.trackSx + state.trackSw;
        row.push(start || pillar || (inSpan && !rng.chance(holeChance)));
      }
      state.rows.push(row);
    }
  };

  ensureRowsUpTo(ROWS_AHEAD);

  return {
    state,
    rulesVersion: KULICKODRAHA_RULES_VERSION,

    step(mask) {
      if (state.over) return;
      const previous = state.previousMask;
      state.previousMask = mask;
      state.tick++;

      // --- Řízení do stran ---
      if (isHeld(mask, BIT.left)) state.x = Math.max(MIN_X, state.x - STEER_SPEED);
      if (isHeld(mask, BIT.right)) state.x = Math.min(MAX_X, state.x + STEER_SPEED);

      // --- Skok: impuls ze země, držení přidává výšku (vlastní fyzika,
      // ne přepis originálu — viz komentář u modulu). ---
      const jumpPressed = justPressed(mask, previous, BIT.a);
      const jumpHeld = isHeld(mask, BIT.a);
      if (jumpPressed && state.onGround) {
        state.vy = JUMP_VELOCITY;
        state.onGround = false;
        state.jumpHoldTicks = 0;
      }
      if (!state.onGround && jumpHeld && state.jumpHoldTicks < MAX_HOLD_TICKS && state.vy > 0) {
        state.vy += JUMP_HOLD_BOOST;
        state.jumpHoldTicks++;
      }

      // --- Gravitace ---
      state.vy -= GRAVITY;
      state.y += state.vy;

      // --- Dopad, nebo propadnutí mezerou ---
      const row = state.rows[Math.floor(state.z) + CAMERA_LOOKAHEAD];
      const col = Math.round(state.x);
      const tileHere = row != null && col >= 0 && col < TRACK_COLS && row[col] === true;
      if (state.y <= 0 && tileHere) {
        state.y = 0;
        state.vy = 0;
        state.onGround = true;
      } else {
        state.onGround = false;
      }

      if (state.y < DEATH_Y) {
        state.over = true;
        return;
      }

      // --- Postup dráhy ---
      state.speed = Math.min(MAX_SPEED, START_SPEED + state.z / SPEED_GAIN_DIVISOR);
      state.z += state.speed;
      state.score = Math.floor(state.z * SCORE_PER_Z);

      ensureRowsUpTo(Math.floor(state.z) + ROWS_AHEAD);
    },
  };
}
