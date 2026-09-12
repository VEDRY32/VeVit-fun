import { describe, it, expect } from 'vitest';
import { createStastnaOpice, MESSAGE_TICKS, type OpiceGame } from '../game.js';
import { SCENES, validateScene } from '../scenes.js';

function run(game: OpiceGame, ticks: number): void {
  for (let i = 0; i < ticks; i++) game.step();
}

/** Projde scénu tak, že klika na všechna místa dokola, dokud nejde dál. */
function solveScene(game: OpiceGame): number {
  let clicks = 0;
  for (let round = 0; round < 8 && !game.state.solved; round++) {
    for (const spot of game.spots()) {
      if (game.state.solved) break;
      game.click(spot.id);
      clicks++;
    }
  }
  return clicks;
}

describe('scény Šťastné opice', () => {
  it('mají platná data', () => {
    for (const scene of SCENES) expect(validateScene(scene), scene.name).toEqual([]);
  });

  it('každá jde dohrát posbíráním a použitím předmětů', () => {
    for (let i = 0; i < SCENES.length; i++) {
      const game = createStastnaOpice('reseni', i);
      solveScene(game);
      expect(game.state.solved, SCENES[i]!.name).toBe(true);
    }
  });
});

describe('klikání', () => {
  it('místo, na které nemáš předmět, jen napoví', () => {
    const game = createStastnaOpice('napoveda');
    const locked = game.spots().find((s) => s.needs)!;
    expect(game.click(locked.id)).toBe(false);
    expect(game.state.message).toBe(locked.missing);
    expect(game.state.inventory).toEqual([]);
  });

  it('sebraný předmět jde rovnou do ruky a zůstane v batohu', () => {
    const game = createStastnaOpice('sber');
    const giver = game.spots().find((s) => s.gives)!;
    expect(game.click(giver.id)).toBe(true);
    expect(game.state.inventory).toContain(giver.gives);
    expect(game.state.held).toBe(giver.gives);
  });

  it('místo s příznakem once po použití zmizí', () => {
    const game = createStastnaOpice('jednou');
    const giver = game.spots().find((s) => s.gives && s.once)!;
    game.click(giver.id);
    expect(game.spots().some((s) => s.id === giver.id)).toBe(false);
    expect(game.click(giver.id)).toBe(false);
  });

  it('marné klikání zhorší náladu, úspěch ji zvedne', () => {
    const game = createStastnaOpice('nalada');
    const mood = game.state.mood;
    game.click('tohle-tam-neni');
    expect(game.state.mood).toBeLessThan(mood);
    const giver = game.spots().find((s) => s.gives)!;
    game.click(giver.id);
    expect(game.state.mood).toBeGreaterThan(mood);
  });

  it('hláška po čase zmizí', () => {
    const game = createStastnaOpice('hlaska');
    expect(game.state.messageTicks).toBeGreaterThan(0);
    run(game, MESSAGE_TICKS + 1);
    expect(game.state.messageTicks).toBe(0);
  });

  it('do ruky jde vzít jen to, co hráč má', () => {
    const game = createStastnaOpice('ruka');
    game.hold('neexistuje');
    expect(game.state.held).toBeNull();
    const giver = game.spots().find((s) => s.gives)!;
    game.click(giver.id);
    game.hold(null);
    expect(game.state.held).toBeNull();
    game.hold(giver.gives!);
    expect(game.state.held).toBe(giver.gives);
  });
});

describe('postup scénami', () => {
  it('vyřešená scéna po oslavě pustí další', () => {
    const game = createStastnaOpice('dalsi');
    solveScene(game);
    expect(game.state.solved).toBe(true);
    run(game, 130);
    expect(game.state.scene).toBe(1);
    expect(game.state.inventory).toEqual([]);
  });

  it('poslední scéna hru dohraje a dál se neklika', () => {
    const game = createStastnaOpice('konec', SCENES.length - 1);
    solveScene(game);
    run(game, 130);
    expect(game.state.won).toBe(true);
    expect(game.click('dvere')).toBe(false);
  });

  it('méně kliknutí dá víc bodů', () => {
    const rychly = createStastnaOpice('rychly');
    solveScene(rychly);
    const rychleSkore = rychly.state.score;

    const pomaly = createStastnaOpice('pomaly');
    for (let i = 0; i < 30; i++) pomaly.click('nikde');
    solveScene(pomaly);
    expect(pomaly.state.score).toBeLessThan(rychleSkore);
  });
});
