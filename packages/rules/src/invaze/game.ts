/**
 * Invaze — formace nepřátel sestupuje a zrychluje, jak jich ubývá.
 *
 * Kryty jsou pixelově rozbitné: každý je bitmapová maska, do které střela
 * vykousne díru. Díky tomu se kryt opotřebovává postupně, ne skokem.
 */

import { createRng, type Rng } from '@vevit-games/engine/core';

export const INVAZE_RULES_VERSION = 1;

export const FIELD_W = 520;
export const FIELD_H = 620;

export const FORMATION_COLS = 11;
export const FORMATION_ROWS = 5;
const ENEMY_W = 26;
const ENEMY_H = 18;
const ENEMY_GAP_X = 14;
const ENEMY_GAP_Y = 14;

export const PLAYER_W = 34;
export const PLAYER_H = 16;
export const PLAYER_Y = FIELD_H - 46;
const PLAYER_SPEED = 4;

const SHOT_SPEED = 8;
const ENEMY_SHOT_SPEED = 3.4;

/** Kryt je mřížka buněk; každá zásah odebere. */
export const SHIELD_COLS = 12;
export const SHIELD_ROWS = 6;
export const SHIELD_CELL = 6;
const SHIELD_COUNT = 4;
const SHIELD_Y = FIELD_H - 130;

export type EnemyKind = 'zakladni' | 'dvojstrelec' | 'stitovy';

export interface Enemy {
  col: number;
  row: number;
  kind: EnemyKind;
  hp: number;
  alive: boolean;
}

export interface Shot {
  x: number;
  y: number;
  vy: number;
  /** Střela hráče, nebo nepřítele. */
  fromPlayer: boolean;
}

export interface Shield {
  x: number;
  /** `cells[row][col]` — `false` znamená vykousnuto. */
  cells: boolean[][];
}

export interface Saucer {
  x: number;
  vx: number;
  active: boolean;
}

export interface InvazeState {
  enemies: Enemy[];
  /** Posun celé formace od výchozí pozice. */
  formationX: number;
  formationY: number;
  direction: 1 | -1;
  shots: Shot[];
  shields: Shield[];
  saucer: Saucer;
  playerX: number;
  lives: number;
  score: number;
  wave: number;
  tick: number;
  moveTimer: number;
  shootCooldown: number;
  /** Krátká nehybnost po zásahu hráče. */
  respawnTimer: number;
  over: boolean;
}

export interface InvazeGame {
  readonly state: InvazeState;
  readonly rulesVersion: number;
  step(left: boolean, right: boolean, fire: boolean): void;
  /** Obdélník nepřítele v souřadnicích pole. */
  enemyRect(enemy: Enemy): { x: number; y: number; w: number; h: number };
  aliveCount(): number;
}

const FORMATION_LEFT = 60;
const FORMATION_TOP = 90;

function kindForRow(row: number, wave: number): EnemyKind {
  // S vlnami přibývají silnější typy shora.
  if (wave >= 3 && row === 0) return 'stitovy';
  if (wave >= 2 && row <= 1) return 'dvojstrelec';
  return 'zakladni';
}

export function createInvaze(seed: string): InvazeGame {
  const rng: Rng = createRng(seed);

  const makeShields = (): Shield[] =>
    Array.from({ length: SHIELD_COUNT }, (_, i) => ({
      x: 50 + i * ((FIELD_W - 100) / (SHIELD_COUNT - 1)) - (SHIELD_COLS * SHIELD_CELL) / 2,
      cells: Array.from({ length: SHIELD_ROWS }, (_, row) =>
        Array.from({ length: SHIELD_COLS }, (_, col) => {
          // Spodní střed krytu je vykrojený, aby se dalo schovat pod okraj.
          const middle = Math.abs(col - (SHIELD_COLS - 1) / 2) < 2;
          return !(row >= SHIELD_ROWS - 2 && middle);
        }),
      ),
    }));

  const makeEnemies = (wave: number): Enemy[] => {
    const enemies: Enemy[] = [];
    for (let row = 0; row < FORMATION_ROWS; row++) {
      for (let col = 0; col < FORMATION_COLS; col++) {
        const kind = kindForRow(row, wave);
        enemies.push({ col, row, kind, hp: kind === 'stitovy' ? 2 : 1, alive: true });
      }
    }
    return enemies;
  };

  const state: InvazeState = {
    enemies: makeEnemies(1),
    formationX: 0,
    formationY: 0,
    direction: 1,
    shots: [],
    shields: makeShields(),
    saucer: { x: -60, vx: 2.2, active: false },
    playerX: FIELD_W / 2,
    lives: 3,
    score: 0,
    wave: 1,
    tick: 0,
    moveTimer: 0,
    shootCooldown: 0,
    respawnTimer: 0,
    over: false,
  };

  const enemyRect = (enemy: Enemy): { x: number; y: number; w: number; h: number } => ({
    x: FORMATION_LEFT + state.formationX + enemy.col * (ENEMY_W + ENEMY_GAP_X),
    y: FORMATION_TOP + state.formationY + enemy.row * (ENEMY_H + ENEMY_GAP_Y),
    w: ENEMY_W,
    h: ENEMY_H,
  });

  const aliveCount = (): number => state.enemies.filter((e) => e.alive).length;

  /** Interval posunu formace: čím míň nepřátel, tím rychleji. */
  const moveInterval = (): number => {
    const alive = aliveCount();
    const total = FORMATION_COLS * FORMATION_ROWS;
    const ratio = alive / total;
    return Math.max(4, Math.round(4 + ratio * 28));
  };

  const advanceFormation = (): void => {
    const alive = state.enemies.filter((e) => e.alive);
    if (alive.length === 0) return;

    const rects = alive.map(enemyRect);
    const left = Math.min(...rects.map((r) => r.x));
    const right = Math.max(...rects.map((r) => r.x + r.w));

    // U kraje formace sestoupí a otočí se.
    if ((state.direction === 1 && right + 12 >= FIELD_W) || (state.direction === -1 && left - 12 <= 0)) {
      state.direction = state.direction === 1 ? -1 : 1;
      state.formationY += 16;
    } else {
      state.formationX += state.direction * 12;
    }

    // Kontakt se zemí znamená prohru bez ohledu na životy.
    if (Math.max(...rects.map((r) => r.y + r.h)) >= PLAYER_Y) state.over = true;
  };

  const enemyShoot = (): void => {
    const alive = state.enemies.filter((e) => e.alive);
    if (alive.length === 0) return;

    // Střílí jen nejnižší nepřítel ve sloupci — horní by trefovali vlastní.
    const lowest = new Map<number, Enemy>();
    for (const enemy of alive) {
      const current = lowest.get(enemy.col);
      if (!current || enemy.row > current.row) lowest.set(enemy.col, enemy);
    }
    const shooters = [...lowest.values()];
    const shooter = shooters[rng.int(0, shooters.length)]!;
    const rect = enemyRect(shooter);

    const count = shooter.kind === 'dvojstrelec' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      state.shots.push({
        x: rect.x + rect.w / 2 + (count === 2 ? (i === 0 ? -6 : 6) : 0),
        y: rect.y + rect.h,
        vy: ENEMY_SHOT_SPEED,
        fromPlayer: false,
      });
    }
  };

  /** Střela vykousne díru do krytu. Vrací `true`, když se trefila. */
  const hitShield = (shot: Shot): boolean => {
    for (const shield of state.shields) {
      const localX = shot.x - shield.x;
      const localY = shot.y - SHIELD_Y;
      if (localX < 0 || localY < 0) continue;
      const col = Math.floor(localX / SHIELD_CELL);
      const row = Math.floor(localY / SHIELD_CELL);
      if (col < 0 || row < 0 || col >= SHIELD_COLS || row >= SHIELD_ROWS) continue;
      if (!shield.cells[row]![col]) continue;

      // Zásah odebere zasaženou buňku i její nejbližší okolí.
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = row + dr;
          const cc = col + dc;
          if (r < 0 || cc < 0 || r >= SHIELD_ROWS || cc >= SHIELD_COLS) continue;
          if (Math.abs(dr) + Math.abs(dc) > 1) continue;
          shield.cells[r]![cc] = false;
        }
      }
      return true;
    }
    return false;
  };

  const nextWave = (): void => {
    state.wave++;
    state.enemies = makeEnemies(state.wave);
    state.formationX = 0;
    state.formationY = 0;
    state.direction = 1;
    state.shots = [];
    state.score += 500;
    // Kryty se s novou vlnou částečně obnoví — jinak by hra byla brzy neúnosná.
    state.shields = makeShields();
  };

  return {
    state,
    rulesVersion: INVAZE_RULES_VERSION,
    enemyRect,
    aliveCount,

    step(left, right, fire) {
      if (state.over) return;
      state.tick++;

      if (state.respawnTimer > 0) {
        state.respawnTimer--;
        return;
      }

      if (left) state.playerX -= PLAYER_SPEED;
      if (right) state.playerX += PLAYER_SPEED;
      state.playerX = Math.max(PLAYER_W / 2, Math.min(FIELD_W - PLAYER_W / 2, state.playerX));

      if (state.shootCooldown > 0) state.shootCooldown--;
      // Jedna střela hráče na obrazovce — drží to tempo hry.
      if (fire && state.shootCooldown === 0 && !state.shots.some((s) => s.fromPlayer)) {
        state.shots.push({ x: state.playerX, y: PLAYER_Y, vy: -SHOT_SPEED, fromPlayer: true });
        state.shootCooldown = 10;
      }

      if (++state.moveTimer >= moveInterval()) {
        state.moveTimer = 0;
        advanceFormation();
      }

      // Nepřátelé střílí tím častěji, čím výš je vlna.
      if (rng.chance(0.012 + state.wave * 0.003)) enemyShoot();

      // Létající talíř: občas přeletí shora a dá bonus.
      if (!state.saucer.active && rng.chance(0.0018)) {
        state.saucer.active = true;
        state.saucer.x = -40;
        state.saucer.vx = 2.2;
      }
      if (state.saucer.active) {
        state.saucer.x += state.saucer.vx;
        if (state.saucer.x > FIELD_W + 40) state.saucer.active = false;
      }

      for (const shot of state.shots) shot.y += shot.vy;

      const surviving: Shot[] = [];
      for (const shot of state.shots) {
        if (shot.y < -10 || shot.y > FIELD_H + 10) continue;
        if (hitShield(shot)) continue;

        if (shot.fromPlayer) {
          // Talíř
          if (state.saucer.active
            && Math.abs(shot.x - state.saucer.x) < 22 && shot.y < 70) {
            state.saucer.active = false;
            state.score += 150;
            continue;
          }

          const hit = state.enemies.find((enemy) => {
            if (!enemy.alive) return false;
            const rect = enemyRect(enemy);
            return shot.x >= rect.x && shot.x <= rect.x + rect.w
              && shot.y >= rect.y && shot.y <= rect.y + rect.h;
          });
          if (hit) {
            hit.hp--;
            if (hit.hp <= 0) {
              hit.alive = false;
              state.score += hit.kind === 'stitovy' ? 40 : hit.kind === 'dvojstrelec' ? 25 : 10;
            }
            continue;
          }
        } else {
          const hitsPlayer = Math.abs(shot.x - state.playerX) < PLAYER_W / 2
            && shot.y >= PLAYER_Y && shot.y <= PLAYER_Y + PLAYER_H;
          if (hitsPlayer) {
            state.lives--;
            state.respawnTimer = 60;
            state.shots = [];
            if (state.lives <= 0) state.over = true;
            return;
          }
        }
        surviving.push(shot);
      }
      state.shots = surviving;

      if (aliveCount() === 0) nextWave();
    },
  };
}

export { SHIELD_Y, ENEMY_W, ENEMY_H, ENEMY_GAP_X, ENEMY_GAP_Y, FORMATION_LEFT, FORMATION_TOP };
