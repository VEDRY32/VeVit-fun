/**
 * Had — pohyb po mřížce, růst a zrychlování.
 *
 * Vstupy se ukládají do krátké fronty (dva tahy), aby rychlé „doleva–nahoru"
 * neztratilo druhý tah, když první ještě nestihl proběhnout.
 */

import { createRng, type Rng } from '@vevit-games/engine';
import { BIT, justPressed } from '../input-bits.js';

export const HAD_RULES_VERSION = 1;

export type HadMode = 'klasik' | 'bez-zdi' | 'bludiste' | 'dva-hraci';
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Point { x: number; y: number }

export interface HadConfig {
  width: number;
  height: number;
  mode: HadMode;
  /** Kroků logiky mezi posunutími na startu. */
  startInterval: number;
  /** Nejrychlejší možné tempo. */
  minInterval: number;
  walls: Point[];
}

export interface HadState {
  /** Hlava je první prvek. */
  body: Point[];
  direction: Dir;
  queue: Dir[];
  food: Point;
  /** Zlaté jablko mizí po pěti sekundách a dá pětinásobek bodů. */
  golden: Point | null;
  goldenTicks: number;
  score: number;
  length: number;
  tick: number;
  moveTimer: number;
  interval: number;
  over: boolean;
  previousMask: number;
}

export interface HadGame {
  readonly state: HadState;
  readonly config: HadConfig;
  readonly rulesVersion: number;
  step(mask: number): void;
  /** Přímé zadání směru — pro švih na mobilu. */
  turn(direction: Dir): void;
}

const DEFAULT_CONFIG: HadConfig = {
  width: 20, height: 20, mode: 'klasik',
  startInterval: 9, minInterval: 3, walls: [],
};

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

export function createHad(seed: string, config: Partial<HadConfig> = {}): HadGame {
  const cfg: HadConfig = { ...DEFAULT_CONFIG, ...config };
  const rng: Rng = createRng(seed);

  const startX = Math.floor(cfg.width / 2);
  const startY = Math.floor(cfg.height / 2);

  const state: HadState = {
    body: [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ],
    direction: 'right',
    queue: [],
    food: { x: 0, y: 0 },
    golden: null,
    goldenTicks: 0,
    score: 0,
    length: 3,
    tick: 0,
    moveTimer: 0,
    interval: cfg.startInterval,
    over: false,
    previousMask: 0,
  };

  const isWall = (p: Point): boolean => cfg.walls.some((w) => w.x === p.x && w.y === p.y);
  const isBody = (p: Point): boolean => state.body.some((b) => b.x === p.x && b.y === p.y);

  const placeFood = (): Point => {
    const free: Point[] = [];
    for (let y = 0; y < cfg.height; y++) {
      for (let x = 0; x < cfg.width; x++) {
        const p = { x, y };
        if (!isBody(p) && !isWall(p)) free.push(p);
      }
    }
    if (free.length === 0) return { x: 0, y: 0 };
    return free[rng.int(0, free.length)]!;
  };

  state.food = placeFood();

  const turn = (direction: Dir): void => {
    // Fronta drží nanejvýš dva tahy; delší by působila „zpožděně".
    if (state.queue.length >= 2) return;
    const last = state.queue[state.queue.length - 1] ?? state.direction;
    if (direction === last || direction === OPPOSITE[last]) return;
    state.queue.push(direction);
  };

  const advance = (): void => {
    const direction = state.queue.shift() ?? state.direction;
    state.direction = direction;

    const delta = DELTA[direction];
    const head = state.body[0]!;
    let next: Point = { x: head.x + delta.x, y: head.y + delta.y };

    if (next.x < 0 || next.y < 0 || next.x >= cfg.width || next.y >= cfg.height) {
      if (cfg.mode === 'bez-zdi') {
        next = {
          x: (next.x + cfg.width) % cfg.width,
          y: (next.y + cfg.height) % cfg.height,
        };
      } else {
        state.over = true;
        return;
      }
    }

    if (isWall(next)) {
      state.over = true;
      return;
    }

    // Ocas se v tomto kroku posune, takže do jeho aktuálního pole se smí.
    const willGrow = (next.x === state.food.x && next.y === state.food.y)
      || (state.golden != null && next.x === state.golden.x && next.y === state.golden.y);
    const bodyToCheck = willGrow ? state.body : state.body.slice(0, -1);
    if (bodyToCheck.some((b) => b.x === next.x && b.y === next.y)) {
      state.over = true;
      return;
    }

    state.body.unshift(next);

    if (next.x === state.food.x && next.y === state.food.y) {
      state.score += 10;
      state.length++;
      state.food = placeFood();
      // Zrychlování: každé jídlo o krok, ke stropu.
      state.interval = Math.max(cfg.minInterval, state.interval - 0.12);
      // Zlaté jablko se objeví zhruba každé šesté jídlo.
      if (state.golden == null && rng.chance(1 / 6)) {
        state.golden = placeFood();
        state.goldenTicks = 5 * 60;
      }
    } else if (state.golden && next.x === state.golden.x && next.y === state.golden.y) {
      state.score += 50;
      state.length++;
      state.golden = null;
      state.goldenTicks = 0;
    } else {
      state.body.pop();
    }
  };

  return {
    state,
    config: cfg,
    rulesVersion: HAD_RULES_VERSION,
    turn,

    step(mask) {
      const previous = state.previousMask;
      state.previousMask = mask;
      if (state.over) return;
      state.tick++;

      if (justPressed(mask, previous, BIT.up)) turn('up');
      if (justPressed(mask, previous, BIT.down)) turn('down');
      if (justPressed(mask, previous, BIT.left)) turn('left');
      if (justPressed(mask, previous, BIT.right)) turn('right');

      if (state.golden && --state.goldenTicks <= 0) state.golden = null;

      if (++state.moveTimer >= Math.round(state.interval)) {
        state.moveTimer = 0;
        advance();
      }
    },
  };
}
