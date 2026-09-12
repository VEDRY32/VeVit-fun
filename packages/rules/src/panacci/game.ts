/**
 * Panáčci — malá strategie na jedné linii.
 *
 * Obě strany kupují jednotky za zlato a posílají je proti sobě. Kopáč
 * nebojuje, zvedá příjem; ostatní jdou k nepřátelské základně a cestou
 * se perou s tím, na co narazí. Vyhrává ten, kdo srazí základnu soupeře.
 *
 * Linie místo plochy je záměr: rozhodování je o skladbě a načasování, ne
 * o kliknutí na správné místo — a hra tím zůstane hratelná na mobilu.
 */

import { createRng, type Rng } from '@vevit-games/engine/core';

export const PANACCI_RULES_VERSION = 1;

export const LANE_LENGTH = 900;
export const BASE_HP = 220;

export type UnitKind = 'kopac' | 'mecnik' | 'lucistnik' | 'obrnenec';
export type Difficulty = 'snadna' | 'stredni' | 'tezka';
export type Side = 'hrac' | 'souper';

export interface UnitStats {
  cost: number;
  hp: number;
  damage: number;
  /** Dosah v pixelech; kopáč nebojuje vůbec. */
  range: number;
  speed: number;
  /** Kroků mezi údery. */
  cooldown: number;
  /** Kolik zlata za krok kopáč přidá. */
  income: number;
  label: string;
}

export const UNITS: Record<UnitKind, UnitStats> = {
  kopac: { cost: 60, hp: 10, damage: 0, range: 0, speed: 0, cooldown: 0, income: 0.05, label: 'Kopáč' },
  mecnik: { cost: 90, hp: 24, damage: 4, range: 20, speed: 0.55, cooldown: 42, income: 0, label: 'Mečník' },
  lucistnik: { cost: 130, hp: 14, damage: 5, range: 95, speed: 0.42, cooldown: 66, income: 0, label: 'Lučištník' },
  obrnenec: { cost: 260, hp: 72, damage: 12, range: 24, speed: 0.26, cooldown: 78, income: 0, label: 'Obrněnec' },
};

export const BUYABLE: UnitKind[] = ['kopac', 'mecnik', 'lucistnik', 'obrnenec'];

export interface Unit {
  kind: UnitKind;
  side: Side;
  x: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  /** Právě útočí — jen pro vykreslení. */
  striking: number;
}

export interface PanacciState {
  difficulty: Difficulty;
  gold: number;
  enemyGold: number;
  baseHp: number;
  enemyBaseHp: number;
  units: Unit[];
  /** Kroků do dalšího rozhodnutí soupeře. */
  enemyThink: number;
  tick: number;
  score: number;
  over: boolean;
  won: boolean;
}

export interface PanacciGame {
  readonly state: PanacciState;
  readonly rulesVersion: number;
  step(): void;
  /** Koupí jednotku hráči; `false`, když na ni nemá. */
  buy(kind: UnitKind): boolean;
  /** Příjem hráče za krok, včetně kopáčů. */
  income(side: Side): number;
}

/** Základní příjem obou stran; kopáči ho zvedají. */
const BASE_INCOME = 0.12;

interface DifficultySpec {
  /** Násobek příjmu soupeře. */
  incomeScale: number;
  /** Kolik zlata si soupeř drží nad cenou, než nakoupí. */
  reserve: number;
  /** Váhy nákupu podle pořadí v BUYABLE. */
  weights: Record<UnitKind, number>;
  /** Kolik kopáčů se soupeř snaží mít. */
  miners: number;
}

const DIFFICULTIES: Record<Difficulty, DifficultySpec> = {
  snadna: {
    incomeScale: 0.8, reserve: 60, miners: 1,
    weights: { kopac: 1, mecnik: 6, lucistnik: 2, obrnenec: 1 },
  },
  stredni: {
    incomeScale: 1, reserve: 20, miners: 2,
    weights: { kopac: 1, mecnik: 5, lucistnik: 4, obrnenec: 2 },
  },
  tezka: {
    incomeScale: 1.25, reserve: 0, miners: 3,
    weights: { kopac: 1, mecnik: 4, lucistnik: 4, obrnenec: 4 },
  },
};

export function createPanacci(seed: string, difficulty: Difficulty = 'stredni'): PanacciGame {
  const rng: Rng = createRng(seed);
  const spec = DIFFICULTIES[difficulty] ?? DIFFICULTIES.stredni;

  const state: PanacciState = {
    difficulty,
    gold: 150,
    enemyGold: 150,
    baseHp: BASE_HP,
    enemyBaseHp: BASE_HP,
    units: [],
    enemyThink: 60,
    tick: 0,
    score: 0,
    over: false,
    won: false,
  };

  const income = (side: Side): number => {
    const miners = state.units.filter((u) => u.side === side && u.kind === 'kopac').length;
    const base = BASE_INCOME + miners * UNITS.kopac.income;
    return side === 'souper' ? base * spec.incomeScale : base;
  };

  const spawn = (kind: UnitKind, side: Side): void => {
    const stats = UNITS[kind];
    state.units.push({
      kind, side,
      x: side === 'hrac' ? 40 : LANE_LENGTH - 40,
      hp: stats.hp,
      maxHp: stats.hp,
      cooldown: 0,
      striking: 0,
    });
  };

  const buy = (kind: UnitKind): boolean => {
    if (state.over || state.won) return false;
    const stats = UNITS[kind];
    if (state.gold < stats.cost) return false;
    state.gold -= stats.cost;
    spawn(kind, 'hrac');
    return true;
  };

  /** Nejbližší nepřítel před jednotkou, nebo `null`. */
  const targetFor = (unit: Unit): Unit | null => {
    const stats = UNITS[unit.kind];
    if (stats.damage === 0) return null;
    let best: Unit | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const other of state.units) {
      if (other.side === unit.side || other.hp <= 0) continue;
      const ahead = unit.side === 'hrac' ? other.x - unit.x : unit.x - other.x;
      if (ahead < -8) continue; // co je za zády, neřešíme
      const distance = Math.abs(other.x - unit.x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = other;
      }
    }
    return best && bestDistance <= stats.range ? best : null;
  };

  /** Soupeřovo rozhodnutí: nejdřív kopáči, pak vážený výběr bojovníků. */
  const enemyDecide = (): void => {
    const miners = state.units.filter((u) => u.side === 'souper' && u.kind === 'kopac').length;
    if (miners < spec.miners && state.enemyGold >= UNITS.kopac.cost + spec.reserve) {
      state.enemyGold -= UNITS.kopac.cost;
      spawn('kopac', 'souper');
      return;
    }

    const fighters = BUYABLE.filter((kind) => kind !== 'kopac');
    const affordable = fighters.filter((kind) => state.enemyGold >= UNITS[kind].cost + spec.reserve);
    if (affordable.length === 0) return;

    const total = affordable.reduce((sum, kind) => sum + spec.weights[kind], 0);
    let roll = rng.int(0, total);
    for (const kind of affordable) {
      roll -= spec.weights[kind];
      if (roll < 0) {
        state.enemyGold -= UNITS[kind].cost;
        spawn(kind, 'souper');
        return;
      }
    }
  };

  return {
    state,
    rulesVersion: PANACCI_RULES_VERSION,
    buy,
    income,

    step() {
      if (state.over || state.won) return;
      state.tick++;

      state.gold += income('hrac');
      state.enemyGold += income('souper');

      if (--state.enemyThink <= 0) {
        enemyDecide();
        state.enemyThink = 45;
      }

      for (const unit of state.units) {
        if (unit.hp <= 0) continue;
        const stats = UNITS[unit.kind];
        if (unit.cooldown > 0) unit.cooldown--;
        if (unit.striking > 0) unit.striking--;
        if (stats.speed === 0) continue;

        const target = targetFor(unit);
        if (target) {
          if (unit.cooldown === 0) {
            target.hp -= stats.damage;
            unit.cooldown = stats.cooldown;
            unit.striking = 10;
          }
          continue;
        }

        // Nikdo v dosahu: jdeme dál, případně mlátíme základnu.
        const atEnemyBase = unit.side === 'hrac'
          ? unit.x >= LANE_LENGTH - 40
          : unit.x <= 40;
        if (atEnemyBase) {
          if (unit.cooldown === 0) {
            unit.cooldown = stats.cooldown;
            unit.striking = 10;
            if (unit.side === 'hrac') state.enemyBaseHp -= stats.damage;
            else state.baseHp -= stats.damage;
          }
          continue;
        }
        unit.x += unit.side === 'hrac' ? stats.speed : -stats.speed;
      }

      for (const unit of state.units) {
        if (unit.hp > 0) continue;
        // Padlý soupeř přidá body podle své ceny.
        if (unit.side === 'souper') state.score += Math.round(UNITS[unit.kind].cost / 2);
      }
      state.units = state.units.filter((u) => u.hp > 0);

      if (state.enemyBaseHp <= 0) {
        state.enemyBaseHp = 0;
        state.won = true;
        state.score += 1000 + Math.max(0, Math.round(state.baseHp)) * 5;
      } else if (state.baseHp <= 0) {
        state.baseHp = 0;
        state.over = true;
      }
    },
  };
}
