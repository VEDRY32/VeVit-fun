# Kuličkodráha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new arcade game, „Kuličkodráha" (a ball rolling forever along a
procedurally generated, gap-filled sky track viewed in pseudo-3D), fully wired
into the existing rules/title/portal architecture.

**Architecture:** Pure deterministic game logic in
`packages/rules/src/kulickodraha/game.ts` (seeded RNG, tick-based `step()`,
no DOM), a separate `titles/kulickodraha/src/render.ts` for the pseudo-3D
canvas drawing, and `titles/kulickodraha/src/index.ts` wiring it to the
engine's loop/surface/input/audio/replay machinery — the same three-way split
every other title in this repo uses (see `titles/utek`, `titles/bezec`).

**Tech Stack:** TypeScript, Vitest, the repo's own `@vevit-games/engine` and
`@vevit-games/rules` workspace packages, Vite (portal dev server), Playwright
(manual smoke test only, not part of the automated suite).

**Spec:** `docs/superpowers/specs/2026-09-12-kulickodraha-design.md`

## Global Constraints

- No `Math.random()` or `Date.now()` anywhere in `packages/rules/**` or
  `titles/kulickodraha/src/**` except the excluded render/attract paths —
  `scripts/check-determinism.mjs` enforces this in `pnpm check`.
- No protected game names anywhere in the repo — `scripts/check-ip.mjs`
  enforces this; "Kuličkodráha" and its English name are not on the
  forbidden list, so no exception needed there.
- The pseudo-3D projection technique and track-generation algorithm are
  adapted from the publicly published JS1024 2026 demo "Skydreams" (Frank
  Force), used **without a verified license, on the explicit, informed risk
  acceptance of the project owner**. This must be recorded in
  `THIRD_PARTY.md` and `DECISIONS.md` (D-019) — see Task 6. The jump
  physics are an original reinterpretation, not a literal port.
- Controls are discrete actions only (`left`/`right`/`a`) — no analog mouse
  position — so the replay format (bitmask per tick) stays valid and the
  run is server-replayable like every other keyboard-only game in the repo.
- Follow existing file conventions: rules package has no title-side
  dependencies; titles under `titles/*` need no `package.json` (recent
  titles like `utek`, `kostka`, `panacci` don't have one — the `@titles/*`
  path alias in `tsconfig.base.json` resolves them directly).

---

### Task 1: Track generation core (rules package scaffold)

**Files:**
- Create: `packages/rules/src/kulickodraha/game.ts`
- Create: `packages/rules/src/kulickodraha/index.ts`
- Create: `packages/rules/src/kulickodraha/__tests__/game.test.ts`

**Interfaces:**
- Produces: `createKulickodraha(seed: string): KulickodrahaGame`, exported
  constants `KULICKODRAHA_RULES_VERSION`, `TRACK_COLS` (=7),
  `CAMERA_LOOKAHEAD` (=3), `ROWS_AHEAD` (=45), `DEATH_Y` (=-4), and the
  `KulickodrahaState` interface with fields: `x, y, vy, onGround,
  jumpHoldTicks, z, speed, rows: boolean[][], trackGap, trackSx, trackSw,
  score, tick, over, previousMask`. `KulickodrahaGame` has `state`,
  `rulesVersion`, `step(mask: number): void`.
- Consumes: `createRng` and `type Rng` from `@vevit-games/engine/core`;
  `BIT`, `justPressed`, `isHeld` from `../input-bits.js` (used starting
  Task 2 — this task only needs `createRng`).

This task builds the track generator and a `step()` that advances distance
and generates rows, but does **not** yet move the ball or end the game —
that's Task 2. This lets the RNG-driven generation be tested in isolation.

- [ ] **Step 1: Write the failing tests**

Create `packages/rules/src/kulickodraha/__tests__/game.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createKulickodraha, TRACK_COLS, ROWS_AHEAD } from '../game.js';

describe('Kuličkodráha — generování dráhy', () => {
  it('vygeneruje dopředu dost řádků na vykreslení', () => {
    const game = createKulickodraha('start');
    expect(game.state.rows.length).toBeGreaterThanOrEqual(ROWS_AHEAD);
    for (const row of game.state.rows) expect(row).toHaveLength(TRACK_COLS);
  });

  it('prvních 35 řádků je vždy plných — bezpečný start', () => {
    const game = createKulickodraha('bezpecny-start');
    for (let r = 0; r < 35; r++) {
      expect(game.state.rows[r]).toEqual(Array(TRACK_COLS).fill(true));
    }
  });

  it('stejný seed dá stejnou dráhu', () => {
    const rowsFor = (seed: string): string => {
      const game = createKulickodraha(seed);
      for (let i = 0; i < 200; i++) game.step(0);
      return JSON.stringify(game.state.rows.slice(0, 100));
    };
    expect(rowsFor('shoda')).toBe(rowsFor('shoda'));
  });

  it('různé seedy dají různou dráhu za bezpečnou zónou', () => {
    const rowsFor = (seed: string): string => {
      const game = createKulickodraha(seed);
      return JSON.stringify(game.state.rows.slice(35, 80));
    };
    expect(rowsFor('seed-a')).not.toBe(rowsFor('seed-b'));
  });

  it('skóre roste, dokud hra běží', () => {
    const game = createKulickodraha('skore');
    let last = 0;
    for (let i = 0; i < 300; i++) {
      game.step(0);
      expect(game.state.score).toBeGreaterThanOrEqual(last);
      last = game.state.score;
    }
    expect(last).toBeGreaterThan(0);
  });

  it('rychlost roste ke stropu', () => {
    const game = createKulickodraha('rychlost');
    for (let i = 0; i < 20000; i++) game.step(0);
    expect(game.state.speed).toBeCloseTo(0.5, 1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/rules/src/kulickodraha/__tests__/game.test.ts`
Expected: FAIL — `../game.js` does not exist yet.

- [ ] **Step 3: Implement the track generator and scaffold**

Create `packages/rules/src/kulickodraha/game.ts`:

```ts
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

    step(_mask) {
      if (state.over) return;
      state.tick++;

      state.speed = Math.min(MAX_SPEED, START_SPEED + state.z / SPEED_GAIN_DIVISOR);
      state.z += state.speed;
      state.score = Math.floor(state.z * SCORE_PER_Z);

      ensureRowsUpTo(Math.floor(state.z) + ROWS_AHEAD);
    },
  };
}
```

Create `packages/rules/src/kulickodraha/index.ts`:

```ts
/** Veřejné API pravidel hry Kuličkodráha. */

export * from './game.js';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/rules/src/kulickodraha/__tests__/game.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/rules/src/kulickodraha
git commit -m "$(cat <<'EOF'
Kuličkodráha: generátor dráhy

Deterministický, seedovaný generátor řádků dráhy s mezerami a
proměnlivou šířkou pruhu. Fyzika a kolize přijdou v dalším kroku.
EOF
)"
```

---

### Task 2: Steering, jump physics, and game over

**Files:**
- Modify: `packages/rules/src/kulickodraha/game.ts`
- Modify: `packages/rules/src/kulickodraha/__tests__/game.test.ts`

**Interfaces:**
- Consumes: everything from Task 1 (`KulickodrahaState`, `TRACK_COLS`,
  `CAMERA_LOOKAHEAD`, `DEATH_Y`), plus new imports `BIT`, `justPressed`,
  `isHeld` from `../input-bits.js`.
- Produces: `step(mask)` now reads `BIT.left`, `BIT.right`, `BIT.a` and
  mutates `x`, `y`, `vy`, `onGround`, `jumpHoldTicks`, `over`. No new
  exported symbols beyond what Task 1 already exports.

- [ ] **Step 1: Write the failing tests**

Append to `packages/rules/src/kulickodraha/__tests__/game.test.ts` (add the
import of `BIT` and `TRACK_COLS`/`DEATH_Y` at the top, then this new
`describe` block):

```ts
import { BIT } from '../../input-bits.js';
```

```ts
describe('Kuličkodráha — pohyb a skok', () => {
  it('řízení do stran posouvá kuličku a nepustí ji do nekonečna', () => {
    const game = createKulickodraha('rizeni');
    for (let i = 0; i < 500; i++) game.step(BIT.left);
    expect(game.state.x).toBeGreaterThanOrEqual(-2);
    const afterLeft = game.state.x;

    const game2 = createKulickodraha('rizeni2');
    for (let i = 0; i < 500; i++) game2.step(BIT.right);
    expect(game2.state.x).toBeLessThanOrEqual(TRACK_COLS + 1);

    expect(afterLeft).toBeLessThan(game2.state.x);
  });

  it('drženie skoku dá vyšší a delší skok než ťuknutí', () => {
    const solidRows = (): boolean[][] => Array.from({ length: 300 }, () => Array(TRACK_COLS).fill(true));

    const tapped = createKulickodraha('tap');
    tapped.state.rows = solidRows();
    tapped.step(BIT.a);
    tapped.step(0);
    let tapPeak = 0;
    let tapAirTicks = 0;
    while (!tapped.state.onGround && tapAirTicks < 200) {
      tapped.step(0);
      tapPeak = Math.max(tapPeak, tapped.state.y);
      tapAirTicks++;
    }

    const held = createKulickodraha('hold');
    held.state.rows = solidRows();
    let heldPeak = 0;
    let heldAirTicks = 0;
    held.step(BIT.a);
    while (!held.state.onGround && heldAirTicks < 200) {
      held.step(BIT.a);
      heldPeak = Math.max(heldPeak, held.state.y);
      heldAirTicks++;
    }

    expect(heldPeak).toBeGreaterThan(tapPeak);
    expect(heldAirTicks).toBeGreaterThan(tapAirTicks);
  });

  it('skok jde jen ze země, ne podruhé ve vzduchu', () => {
    const game = createKulickodraha('dvojskok');
    game.state.rows = Array.from({ length: 300 }, () => Array(TRACK_COLS).fill(true));
    game.step(BIT.a);
    game.step(0);
    const vyAfterFirstJump = game.state.vy;
    game.step(BIT.a); // druhý stisk ve vzduchu nesmí nic udělat
    expect(game.state.vy).toBeLessThanOrEqual(vyAfterFirstJump);
  });

  it('pád do mezery bez skoku ukončí hru', () => {
    const game = createKulickodraha('mezera');
    const col = Math.round(game.state.x);
    const rows = Array.from({ length: 300 }, () => Array(TRACK_COLS).fill(true));
    // Mezera od bezpečné zóny dál, v celém sloupci pod hráčem.
    for (let r = 35; r < 100; r++) rows[r]![col] = false;
    game.state.rows = rows;

    let ticks = 0;
    while (!game.state.over && ticks < 2000) {
      game.step(0);
      ticks++;
    }
    expect(game.state.over).toBe(true);
    expect(game.state.y).toBeLessThan(DEATH_Y);
  });

  it('po konci hry se stav dál nemění', () => {
    const game = createKulickodraha('konec');
    game.state.over = true;
    const snapshot = JSON.stringify(game.state);
    game.step(BIT.a);
    expect(JSON.stringify(game.state)).toBe(snapshot);
  });

  it('stejný seed a stejné vstupy dají stejný běh', () => {
    const play = (): string => {
      const game = createKulickodraha('determinismus');
      for (let i = 0; i < 900; i++) {
        const mask = i % 90 < 20 ? BIT.left : i % 90 < 40 ? BIT.right : i % 150 === 0 ? BIT.a : 0;
        game.step(mask);
      }
      return JSON.stringify({
        x: Math.round(game.state.x * 1000),
        y: Math.round(game.state.y * 1000),
        z: Math.round(game.state.z * 1000),
        score: game.state.score,
        over: game.state.over,
      });
    };
    expect(play()).toBe(play());
  });
});
```

Also add `TRACK_COLS` and `DEATH_Y` to the existing import line from
`'../game.js'` at the top of the file (they're already exported from
Task 1, just not yet imported into the test file for these assertions).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/rules/src/kulickodraha/__tests__/game.test.ts`
Expected: FAIL — steering/jump/game-over don't exist yet, `x` never
changes, `over` never becomes `true`.

- [ ] **Step 3: Implement movement, jump physics, and collision**

In `packages/rules/src/kulickodraha/game.ts`:

Add the import at the top, alongside the existing `createRng` import:

```ts
import { BIT, justPressed, isHeld } from '../input-bits.js';
```

Add new constants right after the existing `SCORE_PER_Z` constant:

```ts
const STEER_SPEED = 0.1;
const MIN_X = -2;
const MAX_X = TRACK_COLS + 1;

const JUMP_VELOCITY = 3.4;
const GRAVITY = 0.2;
const JUMP_HOLD_BOOST = 0.12;
const MAX_HOLD_TICKS = 12;
```

Replace the body of `step()` (currently `step(_mask) { ... }`) with:

```ts
    step(mask) {
      const previous = state.previousMask;
      state.previousMask = mask;
      if (state.over) return;
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/rules/src/kulickodraha/__tests__/game.test.ts`
Expected: PASS (all tests from Task 1 and Task 2 — 12 total).

- [ ] **Step 5: Run the repo's determinism and IP checks**

Run: `node scripts/check-determinism.mjs && node scripts/check-ip.mjs`
Expected: both print success / exit 0. If determinism check fails, search
for a stray `Math.random`/`Date.now` you may have introduced.

- [ ] **Step 6: Commit**

```bash
git add packages/rules/src/kulickodraha
git commit -m "$(cat <<'EOF'
Kuličkodráha: řízení, skok a pád z dráhy

Diskrétní skokový impuls s držením pro výšku (vlastní fyzika),
řízení do stran s mantinely, konec hry při propadnutí mezerou.
EOF
)"
```

---

### Task 3: Manifest and canvas rendering

**Files:**
- Create: `titles/kulickodraha/src/manifest.ts`
- Create: `titles/kulickodraha/src/render.ts`

**Interfaces:**
- Consumes: `TRACK_COLS`, `CAMERA_LOOKAHEAD`, `type KulickodrahaGame` from
  `@vevit-games/rules/kulickodraha`; `herniPaleta`, `withAlpha` from
  `@vevit-games/engine`; `type GameManifest` from `@vevit-games/engine`.
- Produces: `manifest: GameManifest` (slug `'kulickodraha'`); `VIEW_WIDTH`,
  `VIEW_HEIGHT` constants; `KulickodrahaTheme` interface (`accent`,
  `background`, `text`, `textMuted`); `renderKulickodraha(ctx:
  CanvasRenderingContext2D, game: KulickodrahaGame, theme:
  KulickodrahaTheme, options: { bestScore?: number | null }): void`;
  `renderAttract(canvas: HTMLCanvasElement, t: number): void`. Task 4
  imports all of these.

This task has no automated test — canvas drawing is verified visually in
Task 5's manual smoke test. Correctness here is checked by `pnpm
typecheck`.

- [ ] **Step 1: Write the manifest**

Create `titles/kulickodraha/src/manifest.ts`:

```ts
import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'kulickodraha',
  title: { cs: 'Kuličkodráha', en: 'Skyball' },
  tagline: {
    cs: 'Kulička letí po nebeské dráze plné mezer. Uhýbej, skákej, přežij co nejdéle.',
    en: 'A ball races along a sky track full of gaps. Dodge, jump, survive as long as you can.',
  },
  category: 'arkady',
  tags: ['nekonečný běh', 'reflexy', 'rekordy', 'krátká partie'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'denni', name: { cs: 'Denní výzva', en: 'Daily challenge' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: false },
  aspect: { width: 640, height: 400 },
  orientation: 'landscape',
  avgSessionMin: 2,
  difficulty: 3,
  rulesVersion: 1,
};
```

- [ ] **Step 2: Write the renderer**

Create `titles/kulickodraha/src/render.ts`:

```ts
/**
 * Vykreslení Kuličkodráhy.
 *
 * Pseudo-3D projekce (perspektivní dělení + mírné prohnutí dráhy do dálky)
 * vychází z veřejně publikovaného dema „Skydreams" (Frank Force, JS1024
 * 2026) — viz THIRD_PARTY.md, D-019. Barvy jdou přes vlastní herní paletu
 * projektu, ne přes originálovy natvrdo zapsané odstíny.
 */

import { herniPaleta, withAlpha } from '@vevit-games/engine';
import { TRACK_COLS, CAMERA_LOOKAHEAD, type KulickodrahaGame } from '@vevit-games/rules/kulickodraha';

export const VIEW_WIDTH = 640;
export const VIEW_HEIGHT = 400;

const FOCAL = 0.7;

/** Barevné pásmo dráhy podle vzdálených úseků — mění se každých 128 řádků. */
const TRACK_BANDS = [herniPaleta.tyrkys, herniPaleta.indigo, herniPaleta.fialova, herniPaleta.zelena];

/** Zesvětlí (`factor` > 0) nebo ztmaví (`factor` < 0) hex barvu. */
function shade(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (v: number): number => {
    const out = factor >= 0 ? v + (255 - v) * factor : v * (1 + factor);
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  const to = (v: number): string => mix(v).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Perspektivní projekce bodu dráhy do obrazovky. `dz` je vzdálenost před kamerou. */
function project(
  px: number, py: number, dz: number,
  playerX: number, camZ: number, width: number, height: number,
): [x: number, y: number, scale: number] {
  const scale = (height * FOCAL) / dz;
  const x = width / 2 + (px - playerX + ((dz - CAMERA_LOOKAHEAD) ** 2) / 50 * Math.cos((camZ + dz) / 49)) * scale;
  const y = height / 2 - (py - 2 + (dz * dz) / 50) * scale;
  return [x, y, scale];
}

export interface KulickodrahaTheme {
  accent: string;
  background: string;
  text: string;
  textMuted: string;
}

function drawSky(ctx: CanvasRenderingContext2D, width: number, height: number, camZ: number, theme: KulickodrahaTheme): void {
  const bands = 60;
  for (let i = bands; i > 0; i--) {
    const t = i / bands;
    const hueShift = (Math.sin((camZ + i) / 140) + 1) / 2;
    const base = hueShift > 0.5 ? herniPaleta.tyrkys : herniPaleta.indigo;
    ctx.fillStyle = shade(base, 0.55 - t * 0.5);
    ctx.fillRect(0, height * (1 - t), width, height / bands + 1);
  }
  // Hvězdy — deterministické podle indexu, ne náhodné, aby neblikaly mezi snímky.
  ctx.fillStyle = withAlpha(theme.text, 0.7);
  for (let i = 0; i < 80; i++) {
    const sx = (i * 137 + camZ * 4) % width;
    const sy = (i * 61) % (height * 0.5);
    const size = (i % 4) + 1;
    ctx.fillRect(sx, sy, size, size);
  }
}

function drawTrack(ctx: CanvasRenderingContext2D, rows: boolean[][], camZ: number, playerX: number, width: number, height: number): void {
  const nearRow = Math.floor(camZ);
  const farRow = Math.min(rows.length - 1, nearRow + 40);

  for (let r = farRow; r > nearRow; r--) {
    const row = rows[r];
    if (!row) continue;
    const band = TRACK_BANDS[(r >> 7) % TRACK_BANDS.length]!;
    const dzFar = r - camZ;
    if (dzFar <= 0.1) continue;
    const dzNear = dzFar + 1;

    for (let j = 0; j < TRACK_COLS; j++) {
      if (!row[j]) continue;

      const [ax, ay] = project(j - 3.5, 0, dzFar, playerX, camZ, width, height);
      const [bx] = project(j - 2.5, 0, dzFar, playerX, camZ, width, height);
      const [ex, ey] = project(j - 3.5, 0, dzNear, playerX, camZ, width, height);
      const [fx] = project(j - 2.5, 0, dzNear, playerX, camZ, width, height);

      const wallHeight = ((40 - r + camZ) / 30) * height;

      // Boční stěna dlaždice — tmavší, dává dojem hloubky.
      ctx.fillStyle = shade(band, -0.55);
      ctx.fillRect(ex, ey, fx - ex, wallHeight);

      // Vršek dlaždice — jasnější, střídá odstín podle sudosti pole.
      ctx.fillStyle = shade(band, (r + j) % 2 === 0 ? 0.15 : -0.1);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, ay);
      ctx.lineTo(fx, ey);
      ctx.lineTo(ex, ey);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export interface DrawOptions {
  bestScore?: number | null;
}

export function renderKulickodraha(
  ctx: CanvasRenderingContext2D,
  game: KulickodrahaGame,
  theme: KulickodrahaTheme,
  options: DrawOptions = {},
): void {
  const width = VIEW_WIDTH;
  const height = VIEW_HEIGHT;
  const { x: playerX, y: playerY, z: camZ, rows, score, over } = game.state;

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);
  drawSky(ctx, width, height, camZ, theme);
  drawTrack(ctx, rows, camZ, playerX, width, height);

  const ballDz = CAMERA_LOOKAHEAD;
  const [ballX, ballY, ballScale] = project(playerX, playerY, ballDz, playerX, camZ, width, height);
  const radius = Math.max(3, ballScale * 0.55);

  if (playerY <= 0.05) {
    const [shadowX, shadowY] = project(playerX, 0, ballDz, playerX, camZ, width, height);
    ctx.fillStyle = withAlpha('#000000', 0.4);
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, radius * 0.9, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(ballX, ballY - radius, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '600 18px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = theme.text;
  ctx.fillText(String(score).padStart(6, '0'), width - 14, 14);
  if (options.bestScore != null && options.bestScore > 0) {
    ctx.fillStyle = withAlpha(theme.text, 0.5);
    ctx.font = '500 14px ui-monospace, monospace';
    ctx.fillText(`HI ${options.bestScore}`, width - 14, 36);
  }

  if (over) {
    ctx.textAlign = 'center';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillStyle = theme.text;
    ctx.fillText('Pád z dráhy', width / 2, height / 2 - 16);
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillStyle = withAlpha(theme.text, 0.8);
    ctx.fillText(`Skóre ${score}`, width / 2, height / 2 + 14);
  }
}

/** Deterministický vzor dlaždic pro ukázku — bez závislosti na herní logice. */
function attractFilled(rowIndex: number, j: number): boolean {
  return ((rowIndex * 7 + j * 13) % 11) !== 0;
}

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  const camZ = t * 6;
  const playerX = TRACK_COLS / 2 + Math.sin(t * 0.6) * 1.5;
  const theme: KulickodrahaTheme = {
    accent: herniPaleta.zluta, background: '#08090C', text: '#FFFFFF', textMuted: '#A1A1AA',
  };

  c.fillStyle = theme.background;
  c.fillRect(0, 0, width, height);
  drawSky(c, width, height, camZ, theme);

  const rows: boolean[][] = [];
  for (let r = 0; r <= Math.floor(camZ) + 41; r++) {
    rows[r] = Array.from({ length: TRACK_COLS }, (_, j) => attractFilled(r, j));
  }
  drawTrack(c, rows, camZ, playerX, width, height);

  const bounce = Math.abs(Math.sin(t * 2)) * 0.8;
  const [ballX, ballY, ballScale] = project(playerX, bounce, CAMERA_LOOKAHEAD, playerX, camZ, width, height);
  c.fillStyle = theme.accent;
  c.beginPath();
  c.arc(ballX, ballY - Math.max(3, ballScale * 0.55), Math.max(3, ballScale * 0.55), 0, Math.PI * 2);
  c.fill();
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p packages/rules --noEmit && npx tsc -p apps/portal --noEmit`

If `apps/portal`'s tsconfig doesn't yet pick up the new title files because
nothing imports them, that's expected — Task 4 wires the import. At minimum
run `npx tsc --noEmit titles/kulickodraha/src/manifest.ts
titles/kulickodraha/src/render.ts` isn't standalone-valid without the repo's
`tsconfig.base.json` paths; instead just confirm no obvious TypeScript
errors by eye at this step and let Task 4's full typecheck catch real
issues.

- [ ] **Step 4: Commit**

```bash
git add titles/kulickodraha/src/manifest.ts titles/kulickodraha/src/render.ts
git commit -m "$(cat <<'EOF'
Kuličkodráha: manifest a pseudo-3D vykreslení

Katalogová metadata a canvas renderer — projekce a barvení dráhy
adaptované z THIRD_PARTY.md přiznaného zdroje, vlastní herní paleta.
EOF
)"
```

---

### Task 4: Title wiring and catalog registration

**Files:**
- Create: `titles/kulickodraha/src/index.ts`
- Modify: `apps/portal/src/lib/catalog.ts`

**Interfaces:**
- Consumes: `createKulickodraha` from `@vevit-games/rules/kulickodraha`;
  `renderKulickodraha`, `renderAttract`, `VIEW_WIDTH`, `VIEW_HEIGHT` from
  `./render.js`; `manifest` from `./manifest.js`; `createLoop`,
  `createSurface`, `createReplayRecorder`, types `GameContext`,
  `GameInstance`, `GameModule`, `Keymap` from `@vevit-games/engine`.
- Produces: `module_: GameModule` (the file's default export shape every
  title uses), plus named exports `manifest`, `renderAttract`, `keymap`,
  `touchButtons`, `controlHints`, `mount`.

- [ ] **Step 1: Write the title entry point**

Create `titles/kulickodraha/src/index.ts`:

```ts
/**
 * Kuličkodráha — propojení pravidel, enginu a vykreslování.
 */

import {
  createLoop, createSurface, createReplayRecorder,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import { createKulickodraha } from '@vevit-games/rules/kulickodraha';
import { manifest } from './manifest.js';
import { renderKulickodraha, renderAttract, VIEW_WIDTH, VIEW_HEIGHT, type KulickodrahaTheme } from './render.js';

export { manifest, renderAttract };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  a: ['Space'],
};

export const touchButtons = [
  { action: 'left', label: '◀', x: 14, y: 84, size: 62 },
  { action: 'right', label: '▶', x: 28, y: 84, size: 62 },
  { action: 'a', label: '⤒', x: 86, y: 84, size: 62 },
];

export const controlHints = [
  { action: 'left', label: 'Řízení do stran', keys: '← →' },
  { action: 'a', label: 'Skok', keys: 'mezerník' },
];

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_WIDTH, logicalHeight: VIEW_HEIGHT, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  let game = createKulickodraha(ctx.seed);
  let recorder = createReplayRecorder({
    gameSlug: manifest.slug, mode: ctx.mode, seed: ctx.seed,
    rulesVersion: manifest.rulesVersion, clientVersion: __APP_VERSION__,
  });
  let finished = false;
  let lastScore = 0;
  const best = ctx.scores.localBest(ctx.mode);

  const theme: KulickodrahaTheme = {
    accent: ctx.theme.accent,
    background: ctx.theme.background,
    text: ctx.theme.text,
    textMuted: ctx.theme.textMuted,
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('lose');
    const durationMs = Math.round((game.state.tick * 1000) / 60);
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score: game.state.score, durationMs,
      replay: recorder.finish(),
    });
    ctx.emit({ type: 'gameover', score: game.state.score, durationMs });
  };

  const loop = createLoop(
    {
      update() {
        input.sample();
        if (finished) {
          if (input.pressed('a')) ctx.emit({ type: 'restart' });
          return;
        }
        const mask = input.snapshot();
        recorder.record(mask);
        game.step(mask);

        if (game.state.score !== lastScore) {
          lastScore = game.state.score;
          ctx.emit({ type: 'score', value: lastScore });
        }
        if (game.state.over) finish();
      },
      render() {
        surface.begin();
        renderKulickodraha(surface.ctx, game, theme, { bestScore: best });
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
      surface.destroy();
    },
  };
}

export const module_: GameModule = { manifest, mount, renderAttract, keymap, touchButtons, controlHints };
```

- [ ] **Step 2: Register in the catalog**

In `apps/portal/src/lib/catalog.ts`, add an import alongside the other
`manifest as ...` imports (near the `panacci` line at the end of that
block):

```ts
import { manifest as kulickodraha } from '@titles/kulickodraha/src/manifest.js';
```

And add a matching entry to the `catalog` array, alongside the other
`{ manifest: ..., load: () => import(...) }` entries:

```ts
{ manifest: kulickodraha, load: () => import('@titles/kulickodraha/src/index.js') as Promise<GameModule> },
```

- [ ] **Step 3: Typecheck the whole repo**

Run: `pnpm typecheck`
Expected: all 7 sub-project typechecks pass with no errors. If the portal
project reports a missing/incorrect import, double-check the `@titles/`
path alias usage matches the exact casing/slug used elsewhere
(`@titles/kulickodraha/src/manifest.js`, not `.ts`).

- [ ] **Step 4: Run the full test suite and the IP/determinism checks**

Run: `pnpm test && pnpm check`
Expected: all tests pass (previous count + the 12 new Kuličkodráha tests);
`pnpm check` (IP scan + determinism scan) exits 0.

- [ ] **Step 5: Manual smoke test in the browser**

Start the dev server in the background and load the new game:

```bash
npx pnpm --filter @vevit-games/portal dev &
sleep 3
```

Then, using the Playwright MCP tools available in this environment:
1. Navigate to `http://localhost:5173/cs/kulickodraha?rezim=klasik`.
2. Take a screenshot — confirm the sky, track, and a ball are visible and
   the layout isn't broken (letterboxed correctly, HUD score readable).
3. Check the console for errors (ignore the pre-existing `api/runs/start`
   404 — that's the same unrelated backend-not-running noise seen with
   every other game in this environment).
4. Press `ArrowRight` a few times and re-screenshot — confirm the ball
   visibly moves and the camera pans with it.
5. Press `Space` and re-screenshot — confirm the ball visibly leaves the
   ground (shadow separates from the ball, or the ball moves up-screen).
6. Stop the dev server: find its PID with `ss -ltnp | grep 5173` (or the
   backgrounded shell job) and `kill` it — don't leave it running past
   this task.

If the visuals look broken (track tiles overlapping wrong, colors
unreadable, ball invisible), fix `render.ts` from Task 3 and re-run this
smoke test before moving on — this step exists specifically because canvas
code can't be verified by type checking or unit tests alone.

- [ ] **Step 6: Commit**

```bash
git add titles/kulickodraha/src/index.ts apps/portal/src/lib/catalog.ts
git commit -m "$(cat <<'EOF'
Kuličkodráha: napojení na portál a katalog

Hra je teď hratelná z /cs/kulickodraha — mount/smyčka/replay podle
zavedeného vzoru ostatních titulů, registrace v katalogu.
EOF
)"
```

---

### Task 5: Documentation — third-party attribution and decision record

**Files:**
- Modify: `THIRD_PARTY.md`
- Modify: `DECISIONS.md`

**Interfaces:** None — documentation only, no code.

- [ ] **Step 1: Add the attribution to THIRD_PARTY.md**

In `THIRD_PARTY.md`, after the "## Datové sady" section and its
"Atribuce vyžadované ve zveřejněném UI" subsection (right before "##
Vlastní obsah"), insert a new section:

```markdown
## Přejatá mechanika (bez ověřené licence)

| Hra | Zdroj | Co je přejaté | Stav licence |
|---|---|---|---|
| Kuličkodráha | „Skydreams" — Frank Force, JS1024 2026 (`js1024.fun/demos/2026/25/readme`) | Algoritmus generování dráhy s mezerami a technika pseudo-3D perspektivní projekce | **Neověřená.** Použito na výslovné, informované riziko zadavatele projektu — viz `DECISIONS.md` D-019. Skoková fyzika je vlastní, ne převzatá. |
```

Then edit the existing "## Vlastní obsah (žádná třetí strana)" heading's
opening sentence to acknowledge the one exception — change:

```markdown
Veškerá grafika, sprity, úrovně, motivy nonogramů, sady pexesa, postavy Rvačky,
zvuky a hudba jsou vytvořené v tomto repu procedurálně nebo jako data. Žádný
asset nepochází z cizí hry.
```

to:

```markdown
Veškerá grafika, sprity, úrovně, motivy nonogramů, sady pexesa, postavy Rvačky,
zvuky a hudba jsou vytvořené v tomto repu procedurálně nebo jako data. Jedinou
výjimkou je mechanika Kuličkodráhy zaznamenaná výše — žádný jiný asset ani
algoritmus nepochází z cizí hry.
```

- [ ] **Step 2: Add the decision record**

Append to the end of `DECISIONS.md`:

```markdown

## D-019 — Kuličkodráha přejímá mechaniku z neověřeně licencovaného dema

**Stav:** přijato

**Kontext:** zadavatel poskytl kompletní zdrojový kód dema „Skydreams"
(Frank Force, JS1024 2026, copyright autora) a požádal o novou hru
postavenou na jeho mechanice — proceduální generování dráhy s mezerami
a pseudo-3D projekce. Projekt má v `THIRD_PARTY.md` pravidlo „žádný cizí
kód/asset bez ověřené licence, každá položka ověřená před použitím".
Licence tohoto konkrétního dema nebyla ověřena.

**Rozhodnutí:** zadavatel byl na rozpor s pravidlem výslovně upozorněn
před implementací a riziko vědomě přijal. Algoritmus generování dráhy
a technika perspektivní projekce jsou adaptované ze zdroje (viz
`THIRD_PARTY.md`); skoková fyzika je vlastní reinterpretace, ne přepis
originálu — mění hru z automatického odrazu na běžeckou hru s manuálním
skokem, o což si zadavatel řekl zvlášť.

**Důsledky:** `scripts/check-ip.mjs` toto neošetří (hlídá jen chráněné
názvy her, ne provenienci kódu) — kontrola projde bez ohledu na tohle
rozhodnutí. Pokud se do budoucna zjistí, že licence dema use zakazuje,
je třeba `packages/rules/src/kulickodraha` a
`titles/kulickodraha/src/render.ts` přepsat na jinak odvozený algoritmus
nebo hru z katalogu odebrat.
```

- [ ] **Step 3: Commit**

```bash
git add THIRD_PARTY.md DECISIONS.md
git commit -m "$(cat <<'EOF'
Dokumentace: přiznání zdroje mechaniky Kuličkodráhy

THIRD_PARTY.md dostal novou sekci pro neověřeně licencovaný kód a
DECISIONS.md záznam D-019 zdůvodňující vědomou výjimku z pravidla
„žádný cizí kód".
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** rules package (Tasks 1–2), title render (Task 3),
  title wiring + catalog (Task 4), modes klasik/denni (manifest in Task 3
  — no extra game-side code needed, portal's `dailySeed()` handles it
  generically, confirmed against `apps/portal/src/pages/GamePage.tsx`),
  documentation (Task 5). All spec sections have a task.
- **Type consistency:** `KulickodrahaGame`/`KulickodrahaState` field names
  match across Tasks 1, 2, 3, and 4 (`state.x/y/vy/onGround/rows/score/
  over/tick`). `KulickodrahaTheme` shape matches between `render.ts` (Task
  3) and its use in `index.ts` (Task 4).
- **No placeholders:** every step has literal code, not descriptions of
  code.
