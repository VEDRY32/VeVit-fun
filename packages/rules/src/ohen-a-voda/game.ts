/**
 * Oheň a Voda — dvě postavy na jedné klávesnici, jedna úroveň.
 *
 * Každá projde jen svojí kaluží a má vlastní dveře. Úroveň je hotová, až
 * obě stojí ve svých dveřích — sólo se dohrát nedá, o to tu jde.
 *
 * Fyzika je sdílená (`../platform`), aby se skok choval stejně jako
 * v ostatních plošinovkách portálu.
 */

import { BIT, isHeld, justPressed } from '../input-bits.js';
import { createBody, stepBody, hitsSolid, type Body, type TileGrid } from '../platform/index.js';
import { LEVELS, type LevelSpec } from './levels.js';

export const OHEN_VODA_RULES_VERSION = 1;

export const TILE = 26;
export const HERO_W = 16;
export const HERO_H = 22;

const RUN_ACCEL = 0.85;
const RUN_MAX = 3.9;
const FRICTION = 0.76;
const JUMP_VELOCITY = -9.6;
const COYOTE_TICKS = 6;

export type HeroKind = 'ohen' | 'voda';

export interface Hero {
  kind: HeroKind;
  body: Body;
  facing: 1 | -1;
  coyote: number;
  /** Stojí postava ve svých dveřích? */
  atDoor: boolean;
  dead: boolean;
}

export interface Gem {
  kind: HeroKind;
  x: number;
  y: number;
  taken: boolean;
}

export interface OhenVodaState {
  level: number;
  width: number;
  height: number;
  rows: string[];
  ohen: Hero;
  voda: Hero;
  gems: Gem[];
  doors: Record<HeroKind, { x: number; y: number }>;
  /** Je brána otevřená? Otevírá ji kdokoliv stojící na tlačítku. */
  gateOpen: boolean;
  moves: number;
  ticks: number;
  score: number;
  levelDone: boolean;
  failed: boolean;
  won: boolean;
  previousMask: number;
}

export interface OhenVodaGame {
  readonly state: OhenVodaState;
  readonly rulesVersion: number;
  readonly levels: LevelSpec[];
  readonly grid: TileGrid;
  /** Dvě masky: první hráč (Oheň), druhý hráč (Voda). */
  step(maskOhen: number, maskVoda: number): void;
  loadLevel(index: number): void;
  charAt(tx: number, ty: number): string;
}

/** Kaluž, která postavu zabije. */
const DEADLY: Record<HeroKind, string> = {
  ohen: 'wx',
  voda: 'fx',
};

export function createOhenVoda(seed: string, startLevel = 0): OhenVodaGame {
  void seed; // hra nemá náhodu

  const state: OhenVodaState = {
    level: 0,
    width: 0,
    height: 0,
    rows: [],
    ohen: { kind: 'ohen', body: createBody(0, 0, HERO_W, HERO_H), facing: 1, coyote: 0, atDoor: false, dead: false },
    voda: { kind: 'voda', body: createBody(0, 0, HERO_W, HERO_H), facing: -1, coyote: 0, atDoor: false, dead: false },
    gems: [],
    doors: { ohen: { x: 0, y: 0 }, voda: { x: 0, y: 0 } },
    gateOpen: false,
    moves: 0,
    ticks: 0,
    score: 0,
    levelDone: false,
    failed: false,
    won: false,
    previousMask: 0,
  };

  const charAt = (tx: number, ty: number): string => {
    if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return '#';
    return state.rows[ty]![tx] ?? '.';
  };

  const grid: TileGrid = {
    get width() { return state.width; },
    get height() { return state.height; },
    tile: TILE,
    solid(tx, ty) {
      const char = charAt(tx, ty);
      if (char === '#' || char === '=') return true;
      // Brána je pevná, jen dokud nikdo nedrží tlačítko.
      if (char === 'G') return !state.gateOpen;
      return false;
    },
  };

  const placeHero = (hero: Hero, tx: number, ty: number): void => {
    hero.body = createBody(tx * TILE + (TILE - HERO_W) / 2, ty * TILE + TILE - HERO_H, HERO_W, HERO_H);
    hero.coyote = 0;
    hero.atDoor = false;
    hero.dead = false;
  };

  const loadLevel = (index: number): void => {
    const spec = LEVELS[index];
    if (!spec) return;

    state.level = index;
    state.rows = [...spec.rows];
    state.width = spec.rows[0]?.length ?? 0;
    state.height = spec.rows.length;
    state.gems = [];
    state.gateOpen = false;
    state.levelDone = false;
    state.failed = false;
    state.ticks = 0;

    spec.rows.forEach((row, ty) => {
      [...row].forEach((char, tx) => {
        if (char === 'F') placeHero(state.ohen, tx, ty);
        else if (char === 'W') placeHero(state.voda, tx, ty);
        else if (char === 'D') state.doors.ohen = { x: tx * TILE, y: ty * TILE };
        else if (char === 'E') state.doors.voda = { x: tx * TILE, y: ty * TILE };
        else if (char === 'r') state.gems.push({ kind: 'ohen', x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, taken: false });
        else if (char === 'm') state.gems.push({ kind: 'voda', x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, taken: false });
      });
    });
  };

  /** Které znaky se dotýkají spodní poloviny postavy. */
  const charsUnder = (hero: Hero): string[] => {
    const b = hero.body;
    const out: string[] = [];
    const top = Math.floor((b.y + b.h * 0.55) / TILE);
    const bottom = Math.floor((b.y + b.h - 1) / TILE);
    const left = Math.floor((b.x + 3) / TILE);
    const right = Math.floor((b.x + b.w - 4) / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) out.push(charAt(tx, ty));
    }
    return out;
  };

  const controlHero = (hero: Hero, mask: number, previous: number): void => {
    const b = hero.body;
    const left = isHeld(mask, BIT.left);
    const right = isHeld(mask, BIT.right);
    const jump = justPressed(mask, previous, BIT.up) || justPressed(mask, previous, BIT.a);

    if (left && !right) {
      b.vx = Math.max(-RUN_MAX, b.vx - RUN_ACCEL);
      hero.facing = -1;
    } else if (right && !left) {
      b.vx = Math.min(RUN_MAX, b.vx + RUN_ACCEL);
      hero.facing = 1;
    } else {
      b.vx *= FRICTION;
      if (Math.abs(b.vx) < 0.08) b.vx = 0;
    }

    if (b.onGround) hero.coyote = COYOTE_TICKS;
    else if (hero.coyote > 0) hero.coyote--;
    if (jump && hero.coyote > 0) {
      b.vy = JUMP_VELOCITY;
      hero.coyote = 0;
    }

    stepBody(b, grid);
  };

  /** Stojí někdo na tlačítku? */
  const buttonPressed = (): boolean => {
    for (const hero of [state.ohen, state.voda]) {
      if (charsUnder(hero).includes('B')) return true;
    }
    return false;
  };

  const atOwnDoor = (hero: Hero): boolean => {
    const door = state.doors[hero.kind];
    const b = hero.body;
    return b.x + b.w > door.x && b.x < door.x + TILE
      && b.y + b.h > door.y && b.y < door.y + TILE;
  };

  loadLevel(startLevel);

  return {
    state,
    rulesVersion: OHEN_VODA_RULES_VERSION,
    levels: LEVELS,
    grid,
    loadLevel,
    charAt,

    step(maskOhen, maskVoda) {
      if (state.won) return;
      const previousOhen = state.previousMask & 0xffff;
      const previousVoda = (state.previousMask >> 16) & 0xffff;
      state.previousMask = (maskOhen & 0xffff) | ((maskVoda & 0xffff) << 16);

      if (state.failed) {
        // Po neúspěchu se úroveň za chvíli postaví znovu.
        if (++state.ticks % 70 === 0) loadLevel(state.level);
        return;
      }

      if (state.levelDone) {
        if (++state.ticks % 80 === 0) {
          if (state.level + 1 >= LEVELS.length) state.won = true;
          else loadLevel(state.level + 1);
        }
        return;
      }

      state.ticks++;
      // Brána reaguje okamžitě, ještě před pohybem — jinak by postava
      // v okamžiku sešlápnutí zůstala zaseknutá v zavřené bráně.
      state.gateOpen = buttonPressed();

      controlHero(state.ohen, maskOhen, previousOhen);
      controlHero(state.voda, maskVoda, previousVoda);

      for (const hero of [state.ohen, state.voda]) {
        const chars = charsUnder(hero);
        if (chars.some((c) => DEADLY[hero.kind].includes(c))) {
          hero.dead = true;
          state.failed = true;
          state.ticks = 0;
          return;
        }
      }

      for (const gem of state.gems) {
        if (gem.taken) continue;
        const hero = gem.kind === 'ohen' ? state.ohen : state.voda;
        const b = hero.body;
        if (gem.x > b.x - 6 && gem.x < b.x + b.w + 6 && gem.y > b.y - 6 && gem.y < b.y + b.h + 6) {
          gem.taken = true;
          state.score += 100;
        }
      }

      state.ohen.atDoor = atOwnDoor(state.ohen);
      state.voda.atDoor = atOwnDoor(state.voda);
      if (state.ohen.atDoor && state.voda.atDoor) {
        state.levelDone = true;
        state.ticks = 0;
        state.score += 500;
        if (state.gems.every((g) => g.taken)) state.score += 300;
      }
    },
  };
}

/** Pomůcka pro testy i vykreslení: je dlaždice pevná i bez brány? */
export function isWall(char: string): boolean {
  return char === '#' || char === '=';
}

export { hitsSolid };
