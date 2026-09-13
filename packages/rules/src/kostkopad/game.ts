/**
 * Kostkopád — čistá herní logika.
 *
 * Žádný DOM, žádná náhoda mimo seed, žádný reálný čas. Jeden krok logiky
 * odpovídá jednomu kroku smyčky (60 Hz), takže server umí stejný běh přehrát
 * ze záznamu vstupů a ověřit skóre (D-008).
 */

import { createRng, type Rng } from '@vevit-games/engine/core';
import { BIT, justPressed, isHeld } from '../input-bits.js';
import {
  PIECE_SHAPES, kicksFor, rotateIndex,
  type PieceType, type Rotation, type Cell,
} from './pieces.js';
import { createPieceQueue, type PieceQueue } from './bag.js';
import {
  scoreFor, gravityFor, levelFor, breaksB2b, isB2bKind, garbageFor,
  type ClearKind, KOSTKOPAD_RULES_VERSION,
} from './scoring.js';

export const COLS = 10;
export const VISIBLE_ROWS = 20;
/** Dva skryté řádky nad polem — tvar se rodí tam, aby nepřekrýval hromadu. */
export const HIDDEN_ROWS = 2;
export const ROWS = VISIBLE_ROWS + HIDDEN_ROWS;

export const LOCK_DELAY_TICKS = 30; // 500 ms
export const MAX_LOCK_RESETS = 15;
export const SPAWN_DELAY_TICKS = 6;

/** Ultra končí po dvou minutách, Sprint po čtyřiceti řadách. */
export const ULTRA_TICKS = 2 * 60 * 60;
export const SPRINT_LINES = 40;
export const PREVIEW_COUNT = 5;

export type KostkopadMode = 'maraton' | 'sprint40' | 'ultra' | 'denni' | 'souboj';

export interface KostkopadConfig {
  mode: KostkopadMode;
  /** Prodleva před opakováním posunu (ms) a perioda opakování (ms). */
  das: number;
  arr: number;
  /** Startovní úroveň — Maraton začíná na 1. */
  startLevel: number;
}

export const DEFAULT_CONFIG: KostkopadConfig = {
  mode: 'maraton',
  das: 170,
  arr: 50,
  startLevel: 1,
};

export interface ActivePiece {
  type: PieceType;
  rotation: Rotation;
  x: number;
  y: number;
}

export interface LastClear {
  kind: ClearKind;
  lines: number;
  rows: number[];
  points: number;
  perfectClear: boolean;
  backToBack: boolean;
  combo: number;
  garbage: number;
}

export interface KostkopadState {
  /** Pole [řádek][sloupec]; `null` = prázdno, `'G'` = odpadní řádek. */
  board: (PieceType | 'G' | null)[][];
  active: ActivePiece | null;
  hold: PieceType | null;
  holdUsed: boolean;
  preview: PieceType[];

  score: number;
  lines: number;
  level: number;
  combo: number;
  backToBack: boolean;

  tick: number;
  /** Nashromážděná gravitace v Q16.16; při ≥1 buňce tvar spadne. */
  gravityAccum: number;
  lockTimer: number;
  lockResets: number;
  spawnTimer: number;

  /** Poslední akce byla rotace — vstup do detekce T-otočky. */
  lastActionWasRotation: boolean;
  /** Poslední rotace použila poslední (pátou) variantu posunu. */
  lastKickWasLast: boolean;

  dasTimer: number;
  arrTimer: number;
  dasDirection: -1 | 0 | 1;

  softDropCells: number;
  hardDropCells: number;

  over: boolean;
  won: boolean;
  lastClear: LastClear | null;
  /** Odpadní řádky čekající na vsazení (online souboj). */
  pendingGarbage: number;

  previousMask: number;
}

export interface KostkopadGame {
  readonly state: KostkopadState;
  /** Jeden krok logiky s danou maskou vstupů. */
  step(mask: number): void;
  /** Pole pro vykreslení duchu — kam by tvar dopadl. */
  ghostY(): number;
  /** Obsazená pole aktivního tvaru v souřadnicích pole. */
  activeCells(): Cell[];
  /** Přidá odpadní řádky od soupeře (online souboj). */
  queueGarbage(lines: number): void;
  readonly config: KostkopadConfig;
  readonly rulesVersion: number;
}

const emptyBoard = (): (PieceType | 'G' | null)[][] =>
  Array.from({ length: ROWS }, () => Array<PieceType | 'G' | null>(COLS).fill(null));

function cellsOf(piece: ActivePiece): Cell[] {
  return PIECE_SHAPES[piece.type][piece.rotation]!.map((c) => ({
    x: piece.x + c.x,
    y: piece.y + c.y,
  }));
}

function collides(board: (PieceType | 'G' | null)[][], piece: ActivePiece): boolean {
  for (const { x, y } of cellsOf(piece)) {
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    // Nad polem je volno — tvar se tam rodí.
    if (y < 0) continue;
    if (board[y]![x] != null) return true;
  }
  return false;
}

export function createKostkopad(seed: string, config: Partial<KostkopadConfig> = {}): KostkopadGame {
  const cfg: KostkopadConfig = { ...DEFAULT_CONFIG, ...config };
  const rng: Rng = createRng(seed);
  const queue: PieceQueue = createPieceQueue(rng);

  const state: KostkopadState = {
    board: emptyBoard(),
    active: null,
    hold: null,
    holdUsed: false,
    preview: [],
    score: 0,
    lines: 0,
    level: cfg.startLevel,
    combo: -1,
    backToBack: false,
    tick: 0,
    gravityAccum: 0,
    lockTimer: 0,
    lockResets: 0,
    spawnTimer: 0,
    lastActionWasRotation: false,
    lastKickWasLast: false,
    dasTimer: 0,
    arrTimer: 0,
    dasDirection: 0,
    softDropCells: 0,
    hardDropCells: 0,
    over: false,
    won: false,
    lastClear: null,
    pendingGarbage: 0,
    previousMask: 0,
  };

  const spawnX = (type: PieceType): number => (type === 'O' ? 3 : type === 'I' ? 3 : 3);

  const spawn = (type: PieceType): void => {
    const piece: ActivePiece = { type, rotation: 0, x: spawnX(type), y: 0 };
    state.preview = queue.peek(PREVIEW_COUNT);
    // Zablokované pole tvarem = konec hry.
    if (collides(state.board, piece)) {
      state.over = true;
      state.active = null;
      return;
    }
    state.active = piece;
    state.holdUsed = false;
    state.gravityAccum = 0;
    state.lockTimer = 0;
    state.lockResets = 0;
    state.lastActionWasRotation = false;
    state.lastKickWasLast = false;
  };

  const spawnNext = (): void => spawn(queue.next());

  const tryMove = (dx: number, dy: number): boolean => {
    if (!state.active) return false;
    const moved: ActivePiece = { ...state.active, x: state.active.x + dx, y: state.active.y + dy };
    if (collides(state.board, moved)) return false;
    state.active = moved;
    return true;
  };

  const tryRotate = (direction: 1 | -1 | 2): boolean => {
    if (!state.active) return false;
    const from = state.active.rotation;
    const to = rotateIndex(from, direction);
    const kicks = kicksFor(state.active.type, from, to);
    for (let i = 0; i < kicks.length; i++) {
      const [dx, dy] = kicks[i]!;
      const candidate: ActivePiece = {
        type: state.active.type,
        rotation: to,
        x: state.active.x + dx,
        y: state.active.y + dy,
      };
      if (!collides(state.board, candidate)) {
        state.active = candidate;
        state.lastActionWasRotation = true;
        state.lastKickWasLast = i === kicks.length - 1;
        return true;
      }
    }
    return false;
  };

  const grounded = (): boolean => {
    if (!state.active) return false;
    return collides(state.board, { ...state.active, y: state.active.y + 1 });
  };

  /**
   * Detekce T-otočky pravidlem tří rohů.
   * Plné otočení, když jsou obsazené oba rohy na straně, kam T ukazuje;
   * jinak mini.
   */
  const detectTSpin = (piece: ActivePiece): 'none' | 'full' | 'mini' => {
    if (piece.type !== 'T' || !state.lastActionWasRotation) return 'none';

    const cx = piece.x + 1;
    const cy = piece.y + 1;
    const occupied = (x: number, y: number): boolean =>
      x < 0 || x >= COLS || y >= ROWS ? true : y < 0 ? false : state.board[y]![x] != null;

    const corners = [
      occupied(cx - 1, cy - 1), // levý horní
      occupied(cx + 1, cy - 1), // pravý horní
      occupied(cx - 1, cy + 1), // levý dolní
      occupied(cx + 1, cy + 1), // pravý dolní
    ];
    if (corners.filter(Boolean).length < 3) return 'none';

    // Dvojice rohů, kam špička T ukazuje, podle rotace.
    const frontPairs: Record<Rotation, [number, number]> = {
      0: [0, 1], // špička nahoru
      1: [1, 3], // doprava
      2: [2, 3], // dolů
      3: [0, 2], // doleva
    };
    const [a, b] = frontPairs[piece.rotation];
    const bothFront = corners[a]! && corners[b]!;
    // Poslední varianta posunu se uznává jako plná otočka — jinak by
    // technicky správné zasunutí do díry spadlo na mini.
    return bothFront || state.lastKickWasLast ? 'full' : 'mini';
  };

  const clearLines = (): number[] => {
    const cleared: number[] = [];
    for (let y = ROWS - 1; y >= 0; y--) {
      if (state.board[y]!.every((cell) => cell != null)) cleared.push(y);
    }
    for (const y of cleared) {
      state.board.splice(y, 1);
      state.board.unshift(Array<PieceType | 'G' | null>(COLS).fill(null));
    }
    return cleared;
  };

  const isBoardEmpty = (): boolean =>
    state.board.every((row) => row.every((cell) => cell == null));

  const applyGarbage = (): void => {
    if (state.pendingGarbage <= 0) return;
    const lines = Math.min(state.pendingGarbage, 8);
    state.pendingGarbage -= lines;
    // Díra ve stejném sloupci pro celou dávku — soupeř má šanci ji projet.
    const hole = rng.int(0, COLS);
    for (let i = 0; i < lines; i++) {
      state.board.shift();
      const row = Array<PieceType | 'G' | null>(COLS).fill('G');
      row[hole] = null;
      state.board.push(row);
    }
    // Posun aktivního tvaru nahoru, aby se neocitl uvnitř odpadu.
    if (state.active) {
      const lifted = { ...state.active, y: state.active.y - lines };
      if (!collides(state.board, lifted)) state.active = lifted;
    }
  };

  const lockPiece = (): void => {
    const piece = state.active;
    if (!piece) return;

    const tspin = detectTSpin(piece);
    for (const { x, y } of cellsOf(piece)) {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) state.board[y]![x] = piece.type;
    }
    state.active = null;

    const rows = clearLines();
    const lines = rows.length;

    let kind: ClearKind = 'none';
    if (tspin === 'full') {
      kind = (['tspin', 'tspin-single', 'tspin-double', 'tspin-triple'] as const)[lines] ?? 'tspin';
    } else if (tspin === 'mini') {
      kind = (['mini', 'mini-single', 'mini-double'] as const)[lines] ?? 'mini-double';
    } else if (lines > 0) {
      kind = (['none', 'single', 'double', 'triple', 'quad'] as const)[lines] ?? 'quad';
    }

    state.combo = lines > 0 ? state.combo + 1 : -1;
    const perfectClear = lines > 0 && isBoardEmpty();
    const wasB2b = state.backToBack;

    const points = scoreFor({
      kind, lines,
      level: state.level,
      combo: state.combo,
      backToBack: wasB2b,
      perfectClear,
      softDropCells: state.softDropCells,
      hardDropCells: state.hardDropCells,
    });
    state.score += points;
    state.softDropCells = 0;
    state.hardDropCells = 0;

    if (isB2bKind(kind)) state.backToBack = true;
    else if (breaksB2b(kind, lines)) state.backToBack = false;

    const garbage = cfg.mode === 'souboj'
      ? garbageFor(kind, state.combo, wasB2b, perfectClear)
      : 0;

    state.lines += lines;
    if (cfg.mode === 'maraton' || cfg.mode === 'denni') {
      state.level = Math.max(cfg.startLevel, levelFor(state.lines));
    }

    state.lastClear = lines > 0 || kind !== 'none'
      ? { kind, lines, rows, points, perfectClear, backToBack: wasB2b, combo: state.combo, garbage }
      : null;

    // Odpad se vsazuje, jen když hráč sám nic nesmazal — jinak se odečte.
    if (cfg.mode === 'souboj') {
      if (lines > 0) state.pendingGarbage = Math.max(0, state.pendingGarbage - garbage);
      else applyGarbage();
    }

    if (cfg.mode === 'sprint40' && state.lines >= SPRINT_LINES) {
      state.won = true;
      return;
    }

    state.spawnTimer = SPAWN_DELAY_TICKS;
  };

  const doHold = (): void => {
    if (!state.active || state.holdUsed) return;
    const current = state.active.type;
    const swapped = state.hold;
    state.hold = current;
    state.holdUsed = true;
    if (swapped) spawn(swapped);
    else spawnNext();
    // `spawn` příznak shodil, ale držení se v rámci jednoho tvaru použije jen jednou.
    state.holdUsed = true;
  };

  const handleHorizontal = (mask: number, previous: number): void => {
    const leftHeld = isHeld(mask, BIT.left);
    const rightHeld = isHeld(mask, BIT.right);
    const leftTap = justPressed(mask, previous, BIT.left);
    const rightTap = justPressed(mask, previous, BIT.right);

    // Nové ťuknutí vždy přebije drženou opačnou stranu — jinak by se hráč
    // při rychlém přehmátnutí „zasekl" proti stěně.
    if (leftTap) {
      state.dasDirection = -1;
      state.dasTimer = cfg.das;
      state.arrTimer = 0;
      if (tryMove(-1, 0)) onMoved();
      return;
    }
    if (rightTap) {
      state.dasDirection = 1;
      state.dasTimer = cfg.das;
      state.arrTimer = 0;
      if (tryMove(1, 0)) onMoved();
      return;
    }

    if (state.dasDirection === -1 && !leftHeld) state.dasDirection = rightHeld ? 1 : 0;
    if (state.dasDirection === 1 && !rightHeld) state.dasDirection = leftHeld ? -1 : 0;
    if (state.dasDirection === 0) return;

    const msPerTick = 1000 / 60;
    if (state.dasTimer > 0) {
      state.dasTimer -= msPerTick;
      return;
    }
    if (cfg.arr <= 0) {
      // Okamžité dojetí ke stěně.
      while (tryMove(state.dasDirection, 0)) onMoved();
      return;
    }
    state.arrTimer -= msPerTick;
    if (state.arrTimer <= 0) {
      state.arrTimer = cfg.arr;
      if (tryMove(state.dasDirection, 0)) onMoved();
    }
  };

  /** Posun nebo rotace u země resetuje odpočet uzamčení, ale jen 15×. */
  const onMoved = (): void => {
    if (grounded() && state.lockResets < MAX_LOCK_RESETS) {
      state.lockTimer = 0;
      state.lockResets++;
    }
  };

  const game: KostkopadGame = {
    state,
    config: cfg,
    rulesVersion: KOSTKOPAD_RULES_VERSION,

    step(mask) {
      const previous = state.previousMask;
      state.previousMask = mask;
      if (state.over || state.won) return;
      state.tick++;

      if (state.spawnTimer > 0) {
        state.spawnTimer--;
        if (state.spawnTimer === 0) {
          if (cfg.mode === 'souboj') applyGarbage();
          spawnNext();
        }
        return;
      }
      if (!state.active) {
        spawnNext();
        return;
      }

      // Ultra končí po dvou minutách.
      if (cfg.mode === 'ultra' && state.tick >= ULTRA_TICKS) {
        state.over = true;
        return;
      }

      const wasRotation = state.lastActionWasRotation;
      state.lastActionWasRotation = false;

      if (justPressed(mask, previous, BIT.y)) {
        doHold();
        return;
      }

      if (justPressed(mask, previous, BIT.up) || justPressed(mask, previous, BIT.x)) {
        if (tryRotate(1)) onMoved();
        else state.lastActionWasRotation = wasRotation;
      } else if (justPressed(mask, previous, BIT.b)) {
        if (tryRotate(-1)) onMoved();
        else state.lastActionWasRotation = wasRotation;
      } else if (justPressed(mask, previous, BIT.l)) {
        if (tryRotate(2)) onMoved();
        else state.lastActionWasRotation = wasRotation;
      } else {
        state.lastActionWasRotation = wasRotation;
      }

      handleHorizontal(mask, previous);

      if (justPressed(mask, previous, BIT.a)) {
        let cells = 0;
        while (tryMove(0, 1)) cells++;
        state.hardDropCells += cells;
        if (cells > 0) state.lastActionWasRotation = false;
        lockPiece();
        return;
      }

      // Gravitace; při soft dropu 20× rychleji, minimálně jedna buňka za krok.
      const soft = isHeld(mask, BIT.down);
      const gravity = soft ? Math.max(gravityFor(state.level), 20 * 65536 / 60) : gravityFor(state.level);
      state.gravityAccum += gravity;
      while (state.gravityAccum >= 65536) {
        state.gravityAccum -= 65536;
        if (tryMove(0, 1)) {
          if (soft) state.softDropCells++;
          state.lastActionWasRotation = false;
        } else {
          state.gravityAccum = 0;
          break;
        }
      }

      if (grounded()) {
        state.lockTimer++;
        if (state.lockTimer >= LOCK_DELAY_TICKS) lockPiece();
      } else {
        state.lockTimer = 0;
      }
    },

    ghostY() {
      if (!state.active) return 0;
      let y = state.active.y;
      while (!collides(state.board, { ...state.active, y: y + 1 })) y++;
      return y;
    },

    activeCells: () => (state.active ? cellsOf(state.active) : []),

    queueGarbage(lines) {
      state.pendingGarbage += lines;
    },
  };

  spawnNext();
  return game;
}
