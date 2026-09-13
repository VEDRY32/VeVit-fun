/**
 * Poslední obrana — vlny nepřátel proti jedné barikádě.
 *
 * Hráč míří (myší nebo šipkami) a střílí; mezi vlnami si vybere jedno ze
 * tří vylepšení. Konec přijde, až barikáda spadne.
 *
 * Zaměřování je úhel, ne bitová maska, takže se posílá do `step` zvlášť.
 * Náhoda je jen ze seedu — rozestavení vln je tím přehratelné.
 */

import { createRng, type Rng } from '@vevit-games/engine/core';
import { BIT, isHeld, justPressed } from '../input-bits.js';

export const OBRANA_RULES_VERSION = 1;

export const WORLD_W = 720;
export const WORLD_H = 480;
/** Střed hlavně; barikáda stojí pod ním. */
export const TURRET_X = WORLD_W / 2;
export const TURRET_Y = WORLD_H - 58;
export const BARRICADE_Y = WORLD_H - 40;
export const BARRICADE_W = 220;

export type EnemyKind = 'bezec' | 'tezky' | 'plivac';
export type UpgradeKind = 'palba' | 'sila' | 'oprava' | 'zasobnik';

export interface Enemy {
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  /** Odpočet do dalšího plivnutí u plivače. */
  cooldown: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Střela hráče, nebo plivnutí nepřítele. */
  fromPlayer: boolean;
  damage: number;
}

export interface Upgrade {
  kind: UpgradeKind;
  label: string;
}

export interface ObranaState {
  wave: number;
  /** Kolik nepřátel vlny se ještě má objevit. */
  toSpawn: number;
  spawnTimer: number;
  enemies: Enemy[];
  shots: Shot[];
  /** Úhel hlavně v radiánech; 0 = doprava, -PI/2 = nahoru. */
  aim: number;
  barricade: number;
  maxBarricade: number;
  ammo: number;
  magazine: number;
  reloadTimer: number;
  fireTimer: number;
  /** Kroků mezi výstřely. */
  fireInterval: number;
  damage: number;
  score: number;
  tick: number;
  /** Nabídka vylepšení mezi vlnami; prázdná = hraje se. */
  offers: Upgrade[];
  over: boolean;
  previousMask: number;
}

export interface ObranaGame {
  readonly state: ObranaState;
  readonly rulesVersion: number;
  /** `aim` je úhel hlavně; hra ho jen přebírá, nepočítá si ho sama. */
  step(mask: number, aim: number): void;
  /** Výběr vylepšení mezi vlnami (0–2). */
  choose(index: number): boolean;
}

const RELOAD_TICKS = 70;
const SHOT_SPEED = 11;
const SPIT_SPEED = 3.4;

const KIND_STATS: Record<EnemyKind, { hp: number; speed: number; score: number; damage: number }> = {
  bezec: { hp: 2, speed: 0.86, score: 25, damage: 6 },
  tezky: { hp: 7, speed: 0.42, score: 60, damage: 16 },
  plivac: { hp: 3, speed: 0.3, score: 45, damage: 0 },
};

const UPGRADE_LABELS: Record<UpgradeKind, string> = {
  palba: 'Rychlejší palba',
  sila: 'Silnější náboje',
  oprava: 'Oprava barikády',
  zasobnik: 'Větší zásobník',
};

export function createPosledniObrana(seed: string): ObranaGame {
  const rng: Rng = createRng(seed);

  const state: ObranaState = {
    wave: 0,
    toSpawn: 0,
    spawnTimer: 0,
    enemies: [],
    shots: [],
    aim: -Math.PI / 2,
    barricade: 100,
    maxBarricade: 100,
    ammo: 12,
    magazine: 12,
    reloadTimer: 0,
    fireTimer: 0,
    fireInterval: 12,
    damage: 1,
    score: 0,
    tick: 0,
    offers: [],
    over: false,
    previousMask: 0,
  };

  /** Sestaví nabídku tří různých vylepšení. */
  const makeOffers = (): void => {
    const pool: UpgradeKind[] = ['palba', 'sila', 'oprava', 'zasobnik'];
    const offers: Upgrade[] = [];
    while (offers.length < 3 && pool.length > 0) {
      const pick = rng.int(0, pool.length);
      const kind = pool.splice(pick, 1)[0]!;
      offers.push({ kind, label: UPGRADE_LABELS[kind] });
    }
    state.offers = offers;
  };

  const startWave = (): void => {
    state.wave++;
    state.toSpawn = 4 + state.wave * 2;
    state.spawnTimer = 30;
    state.offers = [];
  };

  const spawnEnemy = (): void => {
    // Skladba vlny: běžci od začátku, těžcí od druhé, plivači od třetí.
    const roll = rng.int(0, 100);
    let kind: EnemyKind = 'bezec';
    if (state.wave >= 3 && roll < 22) kind = 'plivac';
    else if (state.wave >= 2 && roll < 50) kind = 'tezky';

    const stats = KIND_STATS[kind];
    const hp = stats.hp + Math.floor(state.wave / 3);
    state.enemies.push({
      kind,
      x: rng.int(40, WORLD_W - 40),
      y: -20 - rng.int(0, 60),
      hp,
      maxHp: hp,
      speed: stats.speed + state.wave * 0.012,
      cooldown: rng.int(60, 180),
    });
    state.toSpawn--;
  };

  const fire = (): void => {
    state.shots.push({
      x: TURRET_X + Math.cos(state.aim) * 22,
      y: TURRET_Y + Math.sin(state.aim) * 22,
      vx: Math.cos(state.aim) * SHOT_SPEED,
      vy: Math.sin(state.aim) * SHOT_SPEED,
      fromPlayer: true,
      damage: state.damage,
    });
    state.ammo--;
    state.fireTimer = state.fireInterval;
    if (state.ammo <= 0) state.reloadTimer = RELOAD_TICKS;
  };

  const hurtBarricade = (amount: number): void => {
    state.barricade -= amount;
    if (state.barricade <= 0) {
      state.barricade = 0;
      state.over = true;
    }
  };

  const choose = (index: number): boolean => {
    const offer = state.offers[index];
    if (!offer) return false;
    switch (offer.kind) {
      case 'palba':
        state.fireInterval = Math.max(4, state.fireInterval - 2);
        break;
      case 'sila':
        state.damage += 1;
        break;
      case 'oprava':
        state.maxBarricade += 10;
        state.barricade = state.maxBarricade;
        break;
      case 'zasobnik':
        state.magazine += 4;
        state.ammo = state.magazine;
        break;
    }
    startWave();
    return true;
  };

  startWave();

  return {
    state,
    rulesVersion: OBRANA_RULES_VERSION,
    choose,

    step(mask, aim) {
      const previous = state.previousMask;
      state.previousMask = mask;
      if (state.over) return;
      state.tick++;
      state.aim = aim;

      // --- Mezi vlnami se jen vybírá ---
      if (state.offers.length > 0) {
        if (justPressed(mask, previous, BIT.left)) choose(0);
        else if (justPressed(mask, previous, BIT.up)) choose(1);
        else if (justPressed(mask, previous, BIT.right)) choose(2);
        return;
      }

      // --- Střelba ---
      if (state.reloadTimer > 0) {
        if (--state.reloadTimer === 0) state.ammo = state.magazine;
      } else {
        if (state.fireTimer > 0) state.fireTimer--;
        const wantsFire = isHeld(mask, BIT.a) || isHeld(mask, BIT.pointer);
        if (wantsFire && state.fireTimer === 0 && state.ammo > 0) fire();
        if (justPressed(mask, previous, BIT.b) && state.ammo < state.magazine) {
          state.reloadTimer = RELOAD_TICKS;
        }
      }

      // --- Vlna ---
      if (state.toSpawn > 0 && --state.spawnTimer <= 0) {
        spawnEnemy();
        state.spawnTimer = Math.max(12, 40 - state.wave * 2);
      }

      // --- Nepřátelé ---
      for (const enemy of state.enemies) {
        const stats = KIND_STATS[enemy.kind];
        if (enemy.kind === 'plivac') {
          // Plivač se zastaví v půlce pole a odtud pálí.
          if (enemy.y < WORLD_H * 0.42) enemy.y += enemy.speed;
          else if (--enemy.cooldown <= 0) {
            enemy.cooldown = 130;
            const dx = TURRET_X - enemy.x;
            const dy = BARRICADE_Y - enemy.y;
            const length = Math.hypot(dx, dy) || 1;
            state.shots.push({
              x: enemy.x, y: enemy.y,
              vx: (dx / length) * SPIT_SPEED,
              vy: (dy / length) * SPIT_SPEED,
              fromPlayer: false,
              damage: 8,
            });
          }
          continue;
        }

        enemy.y += enemy.speed;
        if (enemy.y >= BARRICADE_Y) {
          hurtBarricade(stats.damage);
          enemy.hp = 0;
        }
      }

      // --- Střely ---
      for (const shot of state.shots) {
        shot.x += shot.vx;
        shot.y += shot.vy;
      }

      for (const shot of state.shots) {
        if (shot.fromPlayer) {
          for (const enemy of state.enemies) {
            if (enemy.hp <= 0) continue;
            if (Math.hypot(enemy.x - shot.x, enemy.y - shot.y) > 16) continue;
            enemy.hp -= shot.damage;
            shot.y = -999; // střela je spotřebovaná
            if (enemy.hp <= 0) state.score += KIND_STATS[enemy.kind].score;
            break;
          }
          continue;
        }
        // Plivnutí zasáhne barikádu.
        if (shot.y >= BARRICADE_Y && Math.abs(shot.x - TURRET_X) < BARRICADE_W / 2) {
          hurtBarricade(shot.damage);
          shot.y = 9999;
        }
      }

      state.enemies = state.enemies.filter((e) => e.hp > 0);
      state.shots = state.shots.filter(
        (s) => s.y > -40 && s.y < WORLD_H + 40 && s.x > -40 && s.x < WORLD_W + 40,
      );

      // --- Konec vlny ---
      if (state.toSpawn === 0 && state.enemies.length === 0 && state.offers.length === 0) {
        state.score += 200 + state.wave * 50;
        makeOffers();
      }
    },
  };
}
