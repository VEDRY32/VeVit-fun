/**
 * Pouliční bitka — mlátička z boku s hloubkou ulice.
 *
 * Postavy chodí po pruhu, který má šířku i hloubku: zásah platí, jen když
 * si stojí v podobné hloubce. Bez toho by se hra scvrkla na jednu čáru
 * a uhýbání by nedávalo smysl.
 *
 * Nepřátelé se chovají podle stavu, ne podle náhody; ze seedu jde jen
 * rozestavení vln, takže je běh přehratelný.
 */

import { createRng, type Rng } from '@vevit-games/engine/core';
import { BIT, isHeld, justPressed } from '../input-bits.js';

export const BITKA_RULES_VERSION = 1;

export const WORLD_W = 720;
export const WORLD_H = 400;
/** Hloubka ulice: postavy se pohybují mezi těmito y. */
export const STREET_TOP = 250;
export const STREET_BOTTOM = 368;
/** Jak blízko v hloubce musí být, aby rána platila. */
export const DEPTH_TOLERANCE = 26;

export const FIGHTER_W = 30;
export const FIGHTER_H = 54;

export type AttackKind = 'pesti' | 'kop';
export type EnemyKind = 'rvac' | 'hromotluk';

export interface Fighter {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  facing: 1 | -1;
  /** Kroků do konce probíhajícího úderu; 0 = nebije. */
  attackTicks: number;
  attack: AttackKind;
  /** Kroků, po které nejde udeřit znovu. */
  cooldown: number;
  /** Kroků nezranitelnosti po zásahu. */
  hurtTicks: number;
  /** Odhození po zásahu. */
  knockback: number;
}

export interface Enemy extends Fighter {
  kind: EnemyKind;
  alive: boolean;
  /** Odpočet do dalšího rozhodnutí, aby nepřítel neútočil každý krok. */
  think: number;
}

export interface BitkaState {
  player: Fighter;
  enemies: Enemy[];
  wave: number;
  toSpawn: number;
  spawnTimer: number;
  /** Zásahy za sebou bez ztráty; násobí body. */
  combo: number;
  comboTicks: number;
  score: number;
  tick: number;
  over: boolean;
}

export interface BitkaGame {
  readonly state: BitkaState;
  readonly rulesVersion: number;
  step(mask: number): void;
  /** Obdélník úderu, nebo `null`, když se zrovna nebije. */
  attackBox(fighter: Fighter): { x: number; y: number; w: number; h: number } | null;
}

const MOVE_SPEED = 3.1;
const DEPTH_SPEED = 1.9;
const PUNCH_TICKS = 12;
const KICK_TICKS = 18;
const PUNCH_COOLDOWN = 10;
const KICK_COOLDOWN = 22;
const HURT_TICKS = 26;
const COMBO_WINDOW = 90;

const KIND_STATS: Record<EnemyKind, { health: number; speed: number; damage: number; score: number }> = {
  rvac: { health: 3, speed: 1.5, damage: 1, score: 100 },
  hromotluk: { health: 7, speed: 0.95, damage: 2, score: 220 },
};

const DAMAGE: Record<AttackKind, number> = { pesti: 1, kop: 2 };
const REACH: Record<AttackKind, number> = { pesti: 26, kop: 38 };

function makeFighter(x: number, y: number, health: number, facing: 1 | -1): Fighter {
  return {
    x, y, health, maxHealth: health, facing,
    attackTicks: 0, attack: 'pesti', cooldown: 0, hurtTicks: 0, knockback: 0,
  };
}

export function createPoulicniBitka(seed: string): BitkaGame {
  const rng: Rng = createRng(seed);

  const state: BitkaState = {
    player: makeFighter(120, (STREET_TOP + STREET_BOTTOM) / 2, 10, 1),
    enemies: [],
    wave: 0,
    toSpawn: 0,
    spawnTimer: 0,
    combo: 0,
    comboTicks: 0,
    score: 0,
    tick: 0,
    over: false,
  };

  const attackBox = (fighter: Fighter): { x: number; y: number; w: number; h: number } | null => {
    if (fighter.attackTicks <= 0) return null;
    const reach = REACH[fighter.attack];
    return {
      x: fighter.facing > 0 ? fighter.x + FIGHTER_W : fighter.x - reach,
      y: fighter.y - FIGHTER_H * 0.6,
      w: reach,
      h: FIGHTER_H * 0.6,
    };
  };

  const startWave = (): void => {
    state.wave++;
    state.toSpawn = 2 + state.wave;
    state.spawnTimer = 40;
  };

  const spawnEnemy = (): void => {
    const kind: EnemyKind = state.wave >= 2 && rng.chance(0.35) ? 'hromotluk' : 'rvac';
    const stats = KIND_STATS[kind];
    const fromLeft = rng.chance(0.5);
    const health = stats.health + Math.floor(state.wave / 3);
    const enemy: Enemy = {
      ...makeFighter(fromLeft ? -40 : WORLD_W + 10, rng.int(STREET_TOP, STREET_BOTTOM), health, fromLeft ? 1 : -1),
      kind,
      alive: true,
      think: rng.int(20, 60),
    };
    state.enemies.push(enemy);
    state.toSpawn--;
  };

  /** Sedí si dva soupeři v hloubce? Bez toho rána neplatí. */
  const sameDepth = (a: Fighter, b: Fighter): boolean => Math.abs(a.y - b.y) <= DEPTH_TOLERANCE;

  const hit = (target: Fighter, damage: number, fromX: number): boolean => {
    if (target.hurtTicks > 0) return false;
    target.health -= damage;
    target.hurtTicks = HURT_TICKS;
    target.knockback = target.x < fromX ? -6 : 6;
    target.attackTicks = 0;
    return true;
  };

  const stepFighter = (fighter: Fighter): void => {
    if (fighter.attackTicks > 0) fighter.attackTicks--;
    if (fighter.cooldown > 0) fighter.cooldown--;
    if (fighter.hurtTicks > 0) fighter.hurtTicks--;
    if (fighter.knockback !== 0) {
      fighter.x += fighter.knockback;
      fighter.knockback *= 0.7;
      if (Math.abs(fighter.knockback) < 0.4) fighter.knockback = 0;
    }
    fighter.x = Math.max(-60, Math.min(WORLD_W + 60, fighter.x));
    fighter.y = Math.max(STREET_TOP, Math.min(STREET_BOTTOM, fighter.y));
  };

  startWave();

  return {
    state,
    rulesVersion: BITKA_RULES_VERSION,
    attackBox,

    step(mask) {
      if (state.over) return;
      state.tick++;
      const p = state.player;

      // --- Hráč ---
      const canAct = p.attackTicks === 0 && p.hurtTicks < HURT_TICKS - 6;
      if (canAct) {
        let dx = 0;
        let dy = 0;
        if (isHeld(mask, BIT.left)) dx -= 1;
        if (isHeld(mask, BIT.right)) dx += 1;
        if (isHeld(mask, BIT.up)) dy -= 1;
        if (isHeld(mask, BIT.down)) dy += 1;
        if (dx !== 0) p.facing = dx > 0 ? 1 : -1;
        p.x += dx * MOVE_SPEED;
        p.y += dy * DEPTH_SPEED;

        if (p.cooldown === 0) {
          if (justPressed(mask, 0, BIT.a) || isHeld(mask, BIT.a)) {
            p.attack = 'pesti';
            p.attackTicks = PUNCH_TICKS;
            p.cooldown = PUNCH_COOLDOWN;
          } else if (isHeld(mask, BIT.b)) {
            p.attack = 'kop';
            p.attackTicks = KICK_TICKS;
            p.cooldown = KICK_COOLDOWN;
          }
        }
      }
      stepFighter(p);
      p.x = Math.max(0, Math.min(WORLD_W - FIGHTER_W, p.x));

      // --- Vlna ---
      if (state.toSpawn > 0 && --state.spawnTimer <= 0) {
        spawnEnemy();
        state.spawnTimer = Math.max(20, 60 - state.wave * 4);
      }

      // --- Nepřátelé ---
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        const stats = KIND_STATS[enemy.kind];

        if (enemy.attackTicks === 0 && enemy.hurtTicks === 0) {
          const dx = p.x - enemy.x;
          const dy = p.y - enemy.y;
          enemy.facing = dx > 0 ? 1 : -1;

          if (Math.abs(dx) > 34 || !sameDepth(enemy, p)) {
            // Přibližuje se šikmo: nejdřív hloubka, pak šířka.
            enemy.x += Math.sign(dx) * stats.speed;
            if (Math.abs(dy) > 3) enemy.y += Math.sign(dy) * Math.min(DEPTH_SPEED, stats.speed);
          } else if (--enemy.think <= 0) {
            enemy.attack = 'pesti';
            enemy.attackTicks = PUNCH_TICKS;
            enemy.think = enemy.kind === 'hromotluk' ? 70 : 45;
          }
        }
        stepFighter(enemy);
      }

      // --- Zásahy hráče ---
      const box = attackBox(p);
      if (box) {
        for (const enemy of state.enemies) {
          if (!enemy.alive || !sameDepth(p, enemy)) continue;
          if (enemy.x + FIGHTER_W < box.x || enemy.x > box.x + box.w) continue;
          if (!hit(enemy, DAMAGE[p.attack], p.x)) continue;

          state.combo++;
          state.comboTicks = COMBO_WINDOW;
          if (enemy.health <= 0) {
            enemy.alive = false;
            state.score += KIND_STATS[enemy.kind].score * Math.max(1, state.combo);
          } else {
            state.score += 20 * Math.max(1, state.combo);
          }
        }
      }

      // --- Zásahy nepřátel ---
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        const enemyBox = attackBox(enemy);
        if (!enemyBox || !sameDepth(p, enemy)) continue;
        if (p.x + FIGHTER_W < enemyBox.x || p.x > enemyBox.x + enemyBox.w) continue;
        if (hit(p, KIND_STATS[enemy.kind].damage, enemy.x)) {
          state.combo = 0;
          state.comboTicks = 0;
          if (p.health <= 0) {
            p.health = 0;
            state.over = true;
            return;
          }
        }
      }

      if (state.comboTicks > 0 && --state.comboTicks === 0) state.combo = 0;
      state.enemies = state.enemies.filter((e) => e.alive);

      if (state.toSpawn === 0 && state.enemies.length === 0) {
        state.score += 300 + state.wave * 100;
        // Mezi vlnami se trochu dýchne.
        state.player.health = Math.min(state.player.maxHealth, state.player.health + 2);
        startWave();
      }
    },
  };
}
