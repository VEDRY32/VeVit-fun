/**
 * Hladovec — bludiště s tečkami a čtyřmi pronásledovateli.
 *
 * Každý Prachoš má jinou strategii, takže se nechovají jako jeden houf.
 * Cíle počítají v polích mřížky; pohyb je plynulý mezi středy polí.
 */

import { createRng, distanceField, type Rng, type GridLike } from '@vevit-games/engine/core';
import { MAZES, MAZE_W, MAZE_H, startPosition } from './mazes.js';

export const HLADOVEC_RULES_VERSION = 2;

export type Dir = 'up' | 'down' | 'left' | 'right';
export type ChaserKind = 'lovec' | 'nadbihac' | 'nahoda' | 'plachy';
export type ChaserMode = 'rozptyleni' | 'pronasledovani' | 'vystraseny' | 'navrat';

export interface Point { x: number; y: number }

export interface Chaser {
  kind: ChaserKind;
  x: number;
  y: number;
  direction: Dir;
  mode: ChaserMode;
  /** Kroky do konce vystrašení. */
  frightenedTicks: number;
  /** Doupě, kam se vrací po snědení. */
  home: Point;
  inHouse: boolean;
  releaseTimer: number;
}

export interface HladovecState {
  /** Mřížka: true = průchozí. */
  walls: boolean[][];
  dots: boolean[][];
  powerDots: boolean[][];
  dotsLeft: number;

  playerX: number;
  playerY: number;
  direction: Dir;
  /** Předvolený směr; uplatní se, jakmile to bludiště dovolí. */
  queued: Dir | null;

  chasers: Chaser[];
  /** Střídání rozptýlení a pronásledování. */
  phase: 'rozptyleni' | 'pronasledovani';
  phaseTicks: number;
  phaseIndex: number;

  /** Bonusové ovoce uprostřed; mizí po chvíli. */
  fruit: { x: number; y: number; ticks: number } | null;

  score: number;
  lives: number;
  level: number;
  tick: number;
  /** Násobek bodů za sněženého Prachoše v jedné vlně. */
  eatenStreak: number;
  respawnTimer: number;
  over: boolean;
  won: boolean;
}

export interface HladovecGame {
  readonly state: HladovecState;
  readonly rulesVersion: number;
  step(input: Dir | null): void;
  /** Pole, kterým se dá projít. */
  passable(x: number, y: number): boolean;
  loadLevel(level: number): void;
}

const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down', down: 'up', left: 'right', right: 'left',
};

/** Rychlost v polích za krok logiky. */
/*
 * Rychlosti jsou zlomky 1/n, ne desetinná čísla. Postava se tím trefí
 * přesně do středu pole (po n krocích ujde právě jedno pole), což je
 * podmínka pro `atCenter` — a tedy pro volbu nového směru na křižovatce.
 * Tempo je oproti první verzi zhruba o čtvrtinu nižší; na bludiště 21×21
 * byla hra zbytečně hektická.
 */
const PLAYER_SPEED = 1 / 12;
const CHASER_SPEED = 1 / 14;
const FRIGHTENED_SPEED = 1 / 24;
const RETURN_SPEED = 1 / 7;

/** Všechny rychlosti pohromadě — test hlídá, že dělí pole beze zbytku. */
export const SPEEDS = {
  hrac: PLAYER_SPEED,
  prachos: CHASER_SPEED,
  vystraseny: FRIGHTENED_SPEED,
  navrat: RETURN_SPEED,
} as const;

/** Délky fází rozptýlení a pronásledování v krocích logiky. */
const PHASE_LENGTHS = [7 * 60, 20 * 60, 7 * 60, 20 * 60, 5 * 60, 20 * 60, 5 * 60];
const FRIGHTENED_TICKS = 7 * 60;

/** Rozestup mezi vyjetím jednotlivých Prachošů z doupěte. */
const FIRST_RELEASE_STEP = 180;
const RESPAWN_RELEASE_STEP = 120;
const FRUIT_TICKS = 9 * 60;

/** Rohy, do kterých Prachoši utíkají při rozptýlení. */
const SCATTER_TARGETS: Record<ChaserKind, Point> = {
  lovec: { x: MAZE_W - 2, y: 1 },
  nadbihac: { x: 1, y: 1 },
  nahoda: { x: MAZE_W - 2, y: MAZE_H - 2 },
  plachy: { x: 1, y: MAZE_H - 2 },
};

export function createHladovec(seed: string, startLevel = 0): HladovecGame {
  const rng: Rng = createRng(seed);

  const state: HladovecState = {
    walls: [], dots: [], powerDots: [], dotsLeft: 0,
    playerX: 10, playerY: 15, direction: 'left', queued: null,
    chasers: [],
    phase: 'rozptyleni', phaseTicks: 0, phaseIndex: 0,
    fruit: null,
    score: 0, lives: 3, level: startLevel, tick: 0,
    eatenStreak: 0, respawnTimer: 0, over: false, won: false,
  };

  const passable = (x: number, y: number): boolean => {
    if (y < 0 || y >= MAZE_H) return false;
    // Tunel: mimo šířku se prochází na druhou stranu.
    const wrapped = ((x % MAZE_W) + MAZE_W) % MAZE_W;
    return state.walls[y]?.[wrapped] ?? false;
  };

  const grid: GridLike = { width: MAZE_W, height: MAZE_H, passable };

  const loadLevel = (level: number): void => {
    const maze = MAZES[level % MAZES.length]!;
    state.walls = [];
    state.dots = [];
    state.powerDots = [];
    state.dotsLeft = 0;

    const house: Point[] = [];
    for (let y = 0; y < MAZE_H; y++) {
      const row = maze[y] ?? '';
      const wallRow: boolean[] = [];
      const dotRow: boolean[] = [];
      const powerRow: boolean[] = [];
      // Tunelové `T` na krajích se nepočítají do mřížky.
      const cells = row.replace(/^T/, '.').replace(/T$/, '.');

      for (let x = 0; x < MAZE_W; x++) {
        const char = cells[x] ?? '#';
        wallRow.push(char !== '#');
        dotRow.push(char === '.');
        powerRow.push(char === 'o');
        if (char === '.') state.dotsLeft++;
        if (char === 'o') state.dotsLeft++;
        if (char === '-' || char === ' ') house.push({ x, y });
      }
      state.walls.push(wallRow);
      state.dots.push(dotRow);
      state.powerDots.push(powerRow);
    }

    const houseCenter = house.length > 0
      ? house[Math.floor(house.length / 2)]!
      : { x: Math.floor(MAZE_W / 2), y: Math.floor(MAZE_H / 2) };

    const kinds: ChaserKind[] = ['lovec', 'nadbihac', 'nahoda', 'plachy'];
    state.chasers = kinds.map((kind, i) => ({
      kind,
      x: houseCenter.x + (i - 1.5) * 0.8,
      y: houseCenter.y,
      direction: 'up' as Dir,
      mode: 'rozptyleni' as ChaserMode,
      frightenedTicks: 0,
      home: { ...houseCenter },
      inHouse: i > 0,
      // Prachoši vyjíždějí postupně, aby první minuta nebyla beznadějná.
      releaseTimer: i * FIRST_RELEASE_STEP,
    }));

    // Start se počítá z dat bludiště, ne natvrdo — jinak by změna mapy
    // postavila hráče doprostřed zdi.
    const start = startPosition(maze);
    state.playerX = start.x;
    state.playerY = start.y;
    state.direction = 'left';
    state.queued = null;
    state.phase = 'rozptyleni';
    state.phaseTicks = 0;
    state.phaseIndex = 0;
    state.fruit = null;
    state.level = level;
  };

  loadLevel(startLevel);

  /**
   * Je postava přesně na středu pole?
   *
   * Tolerance musí být menší než nejmenší krok. S dřívější hodnotou 0,06
   * byla větší než krok vystrašeného Prachoše (0,055): ten se po každém
   * kroku „přichytil" zpátky na střed, takže se po velké tečce vůbec
   * nehnul z místa — vypadalo to, že před hráčem neutíká.
   */
  const atCenter = (value: number): boolean => Math.abs(value - Math.round(value)) < 1e-4;

  /**
   * Nejbližší průchozí pole k zadanému bodu.
   * Ovoce se dřív pokládalo na natvrdo spočítaný řádek, který je v prvním
   * bludišti zeď — leželo tedy mimo hru a nešlo sebrat.
   */
  const nearestOpen = (x: number, y: number): Point => {
    for (let radius = 0; radius < Math.max(MAZE_W, MAZE_H); radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (passable(nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    return { x, y };
  };

  const canGo = (x: number, y: number, dir: Dir): boolean => {
    const delta = DELTA[dir];
    return passable(Math.round(x) + delta.x, Math.round(y) + delta.y);
  };

  /** Cíl Prachoše podle jeho povahy. */
  const targetFor = (chaser: Chaser): Point => {
    if (chaser.mode === 'navrat') return chaser.home;
    if (chaser.mode === 'rozptyleni') return SCATTER_TARGETS[chaser.kind];

    const px = Math.round(state.playerX);
    const py = Math.round(state.playerY);
    const ahead = DELTA[state.direction];

    switch (chaser.kind) {
      case 'lovec':
        // Míří přímo na hráče.
        return { x: px, y: py };
      case 'nadbihac':
        // Míří čtyři pole před hráče, takže odřezává cestu.
        return { x: px + ahead.x * 4, y: py + ahead.y * 4 };
      case 'plachy': {
        // Když je blízko, utíká do svého rohu.
        const distance = Math.abs(chaser.x - px) + Math.abs(chaser.y - py);
        return distance < 6 ? SCATTER_TARGETS.plachy : { x: px, y: py };
      }
      case 'nahoda':
      default:
        // Střídá pronásledování a náhodné bloudění.
        return state.tick % 240 < 120
          ? { x: px, y: py }
          : { x: rng.int(1, MAZE_W - 1), y: rng.int(1, MAZE_H - 1) };
    }
  };

  /** Volba směru na křižovatce: nejkratší cesta k cíli, bez otočky. */
  const chooseDirection = (chaser: Chaser): Dir => {
    const cx = Math.round(chaser.x);
    const cy = Math.round(chaser.y);
    const options = (['up', 'left', 'down', 'right'] as Dir[])
      .filter((dir) => dir !== OPPOSITE[chaser.direction])
      .filter((dir) => canGo(cx, cy, dir));

    if (options.length === 0) return OPPOSITE[chaser.direction];
    if (options.length === 1) return options[0]!;

    // Vystrašený Prachoš utíká: z možných směrů volí ten, který ho od
    // hráče vzdálí nejvíc. Dřív volil náhodně, takže hráči často vběhl
    // rovnou do cesty a útěk nebyl poznat.
    if (chaser.mode === 'vystraseny') {
      const px = Math.round(state.playerX);
      const py = Math.round(state.playerY);
      const field = distanceField(grid, { x: px, y: py });
      let best = options[rng.int(0, options.length)]!;
      let bestDistance = -1;
      for (const dir of options) {
        const delta = DELTA[dir];
        const nx = ((cx + delta.x) % MAZE_W + MAZE_W) % MAZE_W;
        const ny = cy + delta.y;
        if (ny < 0 || ny >= MAZE_H) continue;
        const distance = field[ny * MAZE_W + nx] ?? -1;
        if (distance > bestDistance) {
          bestDistance = distance;
          best = dir;
        }
      }
      return best;
    }

    const target = targetFor(chaser);
    const clampedTarget = {
      x: Math.max(0, Math.min(MAZE_W - 1, target.x)),
      y: Math.max(0, Math.min(MAZE_H - 1, target.y)),
    };

    // Vzdálenostní mapa je přesnější než vzdušná čára: Prachoš nezamíří
    // do slepé uličky jen proto, že cíl je vzdušnou čarou blíž.
    const field = distanceField(grid, clampedTarget);
    let best = options[0]!;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const dir of options) {
      const delta = DELTA[dir];
      const nx = ((cx + delta.x) % MAZE_W + MAZE_W) % MAZE_W;
      const ny = cy + delta.y;
      if (ny < 0 || ny >= MAZE_H) continue;
      const distance = field[ny * MAZE_W + nx] ?? Number.POSITIVE_INFINITY;
      if (distance >= 0 && distance < bestDistance) {
        bestDistance = distance;
        best = dir;
      }
    }
    return best;
  };

  const moveEntity = (
    position: { x: number; y: number }, direction: Dir, speed: number,
  ): void => {
    const delta = DELTA[direction];
    position.x += delta.x * speed;
    position.y += delta.y * speed;
    // Tunel
    if (position.x < -0.5) position.x += MAZE_W;
    if (position.x > MAZE_W - 0.5) position.x -= MAZE_W;
  };

  const resetPositions = (): void => {
    const start = startPosition(MAZES[state.level % MAZES.length]!);
    state.playerX = start.x;
    state.playerY = start.y;
    state.direction = 'left';
    state.queued = null;
    state.chasers.forEach((chaser, i) => {
      chaser.x = chaser.home.x + (i - 1.5) * 0.8;
      chaser.y = chaser.home.y;
      chaser.mode = 'rozptyleni';
      chaser.frightenedTicks = 0;
      chaser.inHouse = i > 0;
      // Po smrti kratší prodleva: hráč už bludiště zná a delší čekání
      // by hru jen zpomalilo.
      chaser.releaseTimer = i * RESPAWN_RELEASE_STEP;
    });
  };

  return {
    state,
    rulesVersion: HLADOVEC_RULES_VERSION,
    passable,
    loadLevel,

    step(input) {
      if (state.over || state.won) return;
      state.tick++;

      if (state.respawnTimer > 0) {
        state.respawnTimer--;
        return;
      }

      // --- Fáze rozptýlení a pronásledování ---
      state.phaseTicks++;
      const phaseLength = PHASE_LENGTHS[state.phaseIndex] ?? PHASE_LENGTHS[PHASE_LENGTHS.length - 1]!;
      if (state.phaseTicks >= phaseLength) {
        state.phaseTicks = 0;
        state.phaseIndex = Math.min(state.phaseIndex + 1, PHASE_LENGTHS.length - 1);
        state.phase = state.phase === 'rozptyleni' ? 'pronasledovani' : 'rozptyleni';
        for (const chaser of state.chasers) {
          if (chaser.mode === 'vystraseny' || chaser.mode === 'navrat') continue;
          chaser.mode = state.phase;
          // Změna fáze Prachoše otočí — hráč dostane šanci projít.
          chaser.direction = OPPOSITE[chaser.direction];
        }
      }

      // --- Hráč ---
      if (input) state.queued = input;
      if (state.queued && atCenter(state.playerX) && atCenter(state.playerY)) {
        if (canGo(state.playerX, state.playerY, state.queued)) {
          state.direction = state.queued;
          state.queued = null;
          state.playerX = Math.round(state.playerX);
          state.playerY = Math.round(state.playerY);
        }
      }
      if (canGo(state.playerX, state.playerY, state.direction)
        || !atCenter(state.playerX) || !atCenter(state.playerY)) {
        const position = { x: state.playerX, y: state.playerY };
        moveEntity(position, state.direction, PLAYER_SPEED);
        // Před zdí se zastaví na středu pole.
        const nextCell = { x: Math.round(position.x), y: Math.round(position.y) };
        if (passable(nextCell.x, nextCell.y)) {
          state.playerX = position.x;
          state.playerY = position.y;
        }
      }

      const px = Math.round(state.playerX);
      const py = Math.round(state.playerY);

      // --- Sběr ---
      if (state.dots[py]?.[px]) {
        state.dots[py]![px] = false;
        state.dotsLeft--;
        state.score += 10;
      }
      if (state.powerDots[py]?.[px]) {
        state.powerDots[py]![px] = false;
        state.dotsLeft--;
        state.score += 50;
        state.eatenStreak = 0;
        for (const chaser of state.chasers) {
          if (chaser.mode === 'navrat') continue;
          chaser.mode = 'vystraseny';
          chaser.frightenedTicks = FRIGHTENED_TICKS;
          chaser.direction = OPPOSITE[chaser.direction];
        }
      }

      // --- Ovoce ---
      if (state.fruit) {
        if (--state.fruit.ticks <= 0) state.fruit = null;
        else if (state.fruit.x === px && state.fruit.y === py) {
          state.score += 200;
          state.fruit = null;
        }
      } else if (state.tick % 1200 === 600) {
        const at = nearestOpen(Math.floor(MAZE_W / 2), MAZE_H - 6);
        state.fruit = { x: at.x, y: at.y, ticks: FRUIT_TICKS };
      }

      // --- Prachoši ---
      for (const chaser of state.chasers) {
        if (chaser.inHouse) {
          if (--chaser.releaseTimer <= 0) {
            chaser.inHouse = false;
            chaser.x = chaser.home.x;
            chaser.y = chaser.home.y - 2;
          }
          continue;
        }

        if (chaser.mode === 'vystraseny' && --chaser.frightenedTicks <= 0) {
          chaser.mode = state.phase;
        }
        if (chaser.mode === 'navrat'
          && Math.abs(chaser.x - chaser.home.x) < 0.3
          && Math.abs(chaser.y - chaser.home.y) < 0.3) {
          chaser.mode = state.phase;
        }

        const speed = chaser.mode === 'navrat'
          ? RETURN_SPEED
          : chaser.mode === 'vystraseny' ? FRIGHTENED_SPEED : CHASER_SPEED;

        if (atCenter(chaser.x) && atCenter(chaser.y)) {
          chaser.x = Math.round(chaser.x);
          chaser.y = Math.round(chaser.y);
          chaser.direction = chooseDirection(chaser);
        }
        const position = { x: chaser.x, y: chaser.y };
        moveEntity(position, chaser.direction, speed);
        if (passable(Math.round(position.x), Math.round(position.y))) {
          chaser.x = position.x;
          chaser.y = position.y;
        }

        // --- Střet ---
        if (Math.abs(chaser.x - state.playerX) < 0.6 && Math.abs(chaser.y - state.playerY) < 0.6) {
          if (chaser.mode === 'vystraseny') {
            chaser.mode = 'navrat';
            state.eatenStreak++;
            // Každý další Prachoš v jedné vlně je dvakrát cennější.
            state.score += 200 * 2 ** (state.eatenStreak - 1);
          } else if (chaser.mode !== 'navrat') {
            state.lives--;
            state.respawnTimer = 90;
            resetPositions();
            if (state.lives <= 0) state.over = true;
            return;
          }
        }
      }

      if (state.dotsLeft <= 0) {
        if (state.level + 1 >= MAZES.length) state.won = true;
        else {
          state.score += 1000;
          loadLevel(state.level + 1);
        }
      }
    },
  };
}
