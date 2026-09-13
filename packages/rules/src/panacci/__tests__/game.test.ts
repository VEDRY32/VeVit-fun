import { describe, it, expect } from 'vitest';
import { createPanacci, UNITS, LANE_LENGTH, BASE_HP, type PanacciGame } from '../game.js';

function run(game: PanacciGame, ticks: number): void {
  for (let i = 0; i < ticks; i++) game.step();
}

describe('Panáčci', () => {
  it('začínají s vyrovnaným stavem', () => {
    const game = createPanacci('start');
    expect(game.state.baseHp).toBe(BASE_HP);
    expect(game.state.enemyBaseHp).toBe(BASE_HP);
    expect(game.state.units).toEqual([]);
    expect(game.state.gold).toBeGreaterThan(0);
  });

  it('stejný seed a obtížnost dají stejný průběh', () => {
    const play = (): string => {
      const game = createPanacci('shoda', 'stredni');
      for (let i = 0; i < 1800; i++) {
        if (i % 300 === 0) game.buy('mecnik');
        game.step();
      }
      return JSON.stringify({
        base: Math.round(game.state.baseHp),
        enemy: Math.round(game.state.enemyBaseHp),
        units: game.state.units.map((u) => [u.kind, u.side, Math.round(u.x)]),
      });
    };
    expect(play()).toBe(play());
  });

  it('nákup ubere zlato a postaví jednotku', () => {
    const game = createPanacci('nakup');
    const gold = game.state.gold;
    expect(game.buy('mecnik')).toBe(true);
    expect(game.state.gold).toBe(gold - UNITS.mecnik.cost);
    expect(game.state.units).toHaveLength(1);
  });

  it('bez zlata se nekupuje', () => {
    const game = createPanacci('chudoba');
    game.state.gold = 0;
    expect(game.buy('obrnenec')).toBe(false);
    expect(game.state.units).toEqual([]);
  });

  it('kopáč zvedá příjem a sám nebojuje', () => {
    const game = createPanacci('kopac');
    const before = game.income('hrac');
    game.buy('kopac');
    expect(game.income('hrac')).toBeGreaterThan(before);
    const miner = game.state.units[0]!;
    const x = miner.x;
    run(game, 200);
    expect(miner.x).toBe(x);
  });

  it('bojovník jde k nepřátelské základně a mlátí ji', () => {
    const game = createPanacci('postup');
    game.buy('mecnik');
    const unit = game.state.units[0]!;
    const x = unit.x;
    run(game, 300);
    expect(unit.x).toBeGreaterThan(x);
    // Doběhne až k základně a ubere jí.
    unit.x = LANE_LENGTH - 40;
    game.state.units = [unit];
    const hp = game.state.enemyBaseHp;
    run(game, 120);
    expect(game.state.enemyBaseHp).toBeLessThan(hp);
  });

  it('jednotky se perou, když se potkají', () => {
    const game = createPanacci('souboj');
    game.buy('mecnik');
    const mine = game.state.units[0]!;
    mine.x = 400;
    game.state.units.push({
      kind: 'mecnik', side: 'souper', x: 410,
      hp: UNITS.mecnik.hp, maxHp: UNITS.mecnik.hp, cooldown: 0, striking: 0,
    });
    const enemy = game.state.units[1]!;
    run(game, 60);
    expect(enemy.hp).toBeLessThan(UNITS.mecnik.hp);
    expect(mine.hp).toBeLessThan(UNITS.mecnik.hp);
  });

  it('lučištník střílí dál než mečník', () => {
    expect(UNITS.lucistnik.range).toBeGreaterThan(UNITS.mecnik.range);
    const game = createPanacci('dostrel');
    game.state.gold = 500;
    game.buy('lucistnik');
    const archer = game.state.units[0]!;
    archer.x = 400;
    game.state.units.push({
      kind: 'mecnik', side: 'souper', x: 400 + UNITS.mecnik.range + 20,
      hp: UNITS.mecnik.hp, maxHp: UNITS.mecnik.hp, cooldown: 0, striking: 0,
    });
    const enemy = game.state.units[1]!;
    run(game, 10);
    expect(enemy.hp).toBeLessThan(UNITS.mecnik.hp);
  });

  it('padlý soupeř přidá body a zmizí', () => {
    const game = createPanacci('body');
    game.state.units.push({
      kind: 'mecnik', side: 'souper', x: 400,
      hp: 0, maxHp: UNITS.mecnik.hp, cooldown: 0, striking: 0,
    });
    const score = game.state.score;
    game.step();
    expect(game.state.score).toBeGreaterThan(score);
    expect(game.state.units).toHaveLength(0);
  });

  it('sražená základna soupeře znamená výhru', () => {
    const game = createPanacci('vyhra');
    game.state.enemyBaseHp = 1;
    game.buy('mecnik');
    const unit = game.state.units[0]!;
    unit.x = LANE_LENGTH - 40;
    run(game, 120);
    expect(game.state.won).toBe(true);
    expect(game.state.score).toBeGreaterThan(1000);
  });

  it('sražená vlastní základna znamená prohru', () => {
    const game = createPanacci('prohra');
    game.state.baseHp = 1;
    game.state.units.push({
      kind: 'mecnik', side: 'souper', x: 40,
      hp: UNITS.mecnik.hp, maxHp: UNITS.mecnik.hp, cooldown: 0, striking: 0,
    });
    run(game, 120);
    expect(game.state.over).toBe(true);
  });

  it('těžší soupeř má vyšší příjem než lehčí', () => {
    const snadna = createPanacci('obtiznost', 'snadna');
    const tezka = createPanacci('obtiznost', 'tezka');
    expect(tezka.income('souper')).toBeGreaterThan(snadna.income('souper'));
    // Hráč má na všech obtížnostech stejný příjem.
    expect(tezka.income('hrac')).toBe(snadna.income('hrac'));
  });

  it('na těžší obtížnost postaví soupeř víc jednotek', () => {
    const count = (difficulty: 'snadna' | 'tezka'): number => {
      const game = createPanacci('pocet', difficulty);
      run(game, 3000);
      return game.state.units.filter((u) => u.side === 'souper').length
        + Math.round((3000 * game.income('souper')) / 100);
    };
    expect(count('tezka')).toBeGreaterThan(count('snadna'));
  });
});
