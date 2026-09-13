import { describe, it, expect } from 'vitest';
import { createPruchody, TILE, type PruchodyGame } from '../game.js';
import { LEVELS, validateLevel } from '../levels.js';

function run(game: PruchodyGame, ticks: number): void {
  for (let i = 0; i < ticks; i++) game.step();
}

/** Najde první dlaždici daného znaku. */
function find(game: PruchodyGame, char: string): { x: number; y: number } {
  for (let ty = 0; ty < game.state.height; ty++) {
    const tx = game.state.rows[ty]!.indexOf(char);
    if (tx >= 0) return { x: tx, y: ty };
  }
  throw new Error(`Znak ${char} ve scéně není.`);
}

describe('úrovně Průchodů', () => {
  it('mají správný tvar', () => {
    for (const level of LEVELS) expect(validateLevel(level), level.name).toEqual([]);
  });
});

describe('pokládání průchodů', () => {
  it('na obyčejnou stěnu jde, na kov ne', () => {
    const game = createPruchody('pokladani', 1);
    // Podlaha, klik u její horní hrany: ústí míří nahoru do volného prostoru.
    const floorY = game.state.height - 1;
    expect(game.place(0, TILE * 3 + TILE / 2, floorY * TILE + 2)).toBe(true);

    const metal = find(game, 'x');
    expect(game.place(1, metal.x * TILE + TILE / 2, metal.y * TILE + TILE - 2)).toBe(false);
  });

  it('do prázdna průchod nejde', () => {
    const game = createPruchody('prazdno');
    expect(game.place(0, TILE * 5 + 10, TILE * 3 + 10)).toBe(false);
  });

  it('ústí musí mířit do volného prostoru', () => {
    const game = createPruchody('usti');
    // Horní okraj: strana nahoru míří ven z mapy, tam se položit nedá.
    expect(game.place(0, TILE * 5 + TILE / 2, 2)).toBe(false);
    // Stejná dlaždice zespoda ale ano.
    expect(game.place(0, TILE * 5 + TILE / 2, TILE - 2)).toBe(true);
  });

  it('oba průchody nemůžou být na stejném ústí', () => {
    const game = createPruchody('shodne');
    const x = TILE * 5 + TILE / 2;
    const y = TILE - 2;
    expect(game.place(0, x, y)).toBe(true);
    expect(game.place(1, x, y)).toBe(false);
  });
});

describe('kulička', () => {
  it('před puštěním stojí', () => {
    const game = createPruchody('cekani');
    const start = { ...game.state.ball };
    run(game, 60);
    expect(game.state.ball).toEqual(start);
  });

  it('po puštění padá a zrychluje', () => {
    const game = createPruchody('pad');
    game.release();
    run(game, 10);
    const speed = game.state.ball.vy;
    run(game, 10);
    expect(game.state.ball.vy).toBeGreaterThan(speed);
    expect(game.state.ball.y).toBeGreaterThan(game.state.start.y);
  });

  it('dopadne na podlahu a nepropadne', () => {
    const game = createPruchody('podlaha');
    game.release();
    run(game, 600);
    expect(game.state.ball.y).toBeLessThan(game.state.height * TILE);
  });

  it('průchod zachová rychlost a otočí směr', () => {
    const game = createPruchody('hybnost');
    // Průchod dole uprostřed (do něj se padá) a druhý v levé stěně.
    const floorY = game.state.height - 1;
    expect(game.place(0, TILE * 3 + TILE / 2, floorY * TILE + 2)).toBe(true);
    // Klik u pravé hrany levé stěny, aby ústí mířilo doprava do volna.
    expect(game.place(1, TILE - 2, TILE * 3 + TILE / 2)).toBe(true);

    game.state.ball.x = TILE * 3 + TILE / 2;
    game.state.ball.y = (floorY - 1) * TILE;
    game.state.ball.vx = 0;
    game.state.ball.vy = 6;
    game.state.released = true;

    const before = Math.hypot(game.state.ball.vx, game.state.ball.vy);
    run(game, 12);
    const after = Math.hypot(game.state.ball.vx, game.state.ball.vy);
    // Rychlost se nesmí ztratit; gravitace ji mezitím může jen zvýšit.
    expect(after).toBeGreaterThanOrEqual(before - 0.01);
    // A kulička vyletěla doprava z levé stěny.
    expect(game.state.ball.vx).toBeGreaterThan(0);
  });

  it('nástrahy vrátí kuličku na start', () => {
    const game = createPruchody('nastrahy', 2);
    game.release();
    const spikes = find(game, '^');
    game.state.ball.x = spikes.x * TILE + TILE / 2;
    game.state.ball.y = spikes.y * TILE + TILE / 2;
    game.step();
    expect(game.state.released).toBe(false);
    expect(game.state.ball.x).toBe(game.state.start.x);
  });

  it('opakované puštění kuličku vrátí na start', () => {
    const game = createPruchody('znovu');
    game.release();
    run(game, 30);
    expect(game.state.ball.y).toBeGreaterThan(game.state.start.y);
    game.release();
    expect(game.state.ball.y).toBe(game.state.start.y);
    expect(game.state.released).toBe(false);
  });
});

describe('postup', () => {
  it('dosažení cíle dokončí úroveň a pustí další', () => {
    const game = createPruchody('cil');
    game.release();
    game.state.ball.x = game.state.goal.x;
    game.state.ball.y = game.state.goal.y;
    game.step();
    expect(game.state.levelDone).toBe(true);
    expect(game.state.score).toBeGreaterThan(0);
    run(game, 100);
    expect(game.state.level).toBe(1);
  });

  it('poslední úroveň hru dohraje', () => {
    const game = createPruchody('konec', LEVELS.length - 1);
    game.release();
    game.state.ball.x = game.state.goal.x;
    game.state.ball.y = game.state.goal.y;
    game.step();
    run(game, 100);
    expect(game.state.won).toBe(true);
  });

  it('míň pokusů dá víc bodů', () => {
    const rychly = createPruchody('rychly');
    rychly.release();
    rychly.state.ball.x = rychly.state.goal.x;
    rychly.state.ball.y = rychly.state.goal.y;
    rychly.step();

    const pomaly = createPruchody('pomaly');
    for (let i = 0; i < 12; i++) {
      pomaly.release();
      pomaly.release();
    }
    pomaly.release();
    pomaly.state.ball.x = pomaly.state.goal.x;
    pomaly.state.ball.y = pomaly.state.goal.y;
    pomaly.step();

    expect(pomaly.state.score).toBeLessThan(rychly.state.score);
  });
});
