import { describe, it, expect } from 'vitest';
import {
  createCihlobijec, FIELD_W, FIELD_H, PADDLE_Y, BRICK_TOP, BRICK_H, BRICK_W,
  type CihlobijecGame,
} from '../game.js';

const BRICK_W_TEST = BRICK_W;

/** Posune hru o `n` kroků s pádlem na daném místě. */
function run(game: CihlobijecGame, n: number, paddle = FIELD_W / 2): void {
  for (let i = 0; i < n; i++) game.step(paddle, false, false);
}

/** Vystřelí míček z pádla. */
function release(game: CihlobijecGame): void {
  game.step(FIELD_W / 2, true, false);
}

describe('Cihlobijec — start', () => {
  it('začíná s míčkem přilepeným na pádle', () => {
    const game = createCihlobijec('start');
    expect(game.state.balls).toHaveLength(1);
    expect(game.state.balls[0]!.stuck).toBe(true);
    expect(game.state.lives).toBe(3);
  });

  it('přilepený míček se drží pádla', () => {
    const game = createCihlobijec('drzeni');
    run(game, 5, 120);
    expect(game.state.balls[0]!.x).toBeCloseTo(game.state.paddleX, 1);
    expect(game.state.balls[0]!.y).toBeLessThan(PADDLE_Y);
  });

  it('vystřelení míček rozpohybuje', () => {
    const game = createCihlobijec('vystrel');
    release(game);
    expect(game.state.balls[0]!.stuck).toBe(false);
    expect(game.state.balls[0]!.vy).toBeLessThan(0);
  });

  it('úroveň má rozbitné i nerozbitné cihly podle mapy', () => {
    const game = createCihlobijec('mapa');
    expect(game.remaining()).toBeGreaterThan(0);
    expect(game.state.bricks.every((b) => b.col >= 0 && b.col < 10)).toBe(true);
  });

  it('stejný seed dá stejné rozmístění vylepšení', () => {
    const a = createCihlobijec('stejne');
    const b = createCihlobijec('stejne');
    expect(a.state.bricks.map((x) => x.powerup)).toEqual(b.state.bricks.map((x) => x.powerup));
  });
});

describe('Cihlobijec — odrazy', () => {
  it('míček se odrazí od boční stěny', () => {
    const game = createCihlobijec('stena');
    release(game);
    game.state.balls[0] = { x: 10, y: 300, vx: -6, vy: -2, stuck: false, piercing: false };
    run(game, 4);
    expect(game.state.balls[0]!.vx).toBeGreaterThan(0);
    expect(game.state.balls[0]!.x).toBeGreaterThanOrEqual(0);
  });

  it('míček se odrazí od stropu', () => {
    const game = createCihlobijec('strop');
    release(game);
    game.state.balls[0] = { x: 240, y: 8, vx: 1, vy: -6, stuck: false, piercing: false };
    run(game, 3);
    expect(game.state.balls[0]!.vy).toBeGreaterThan(0);
  });

  it('úhel odrazu závisí na místě dopadu na pádlo', () => {
    const left = createCihlobijec('padlo-vlevo');
    release(left);
    left.state.paddleX = 240;
    left.state.balls[0] = { x: 210, y: PADDLE_Y - 8, vx: 0, vy: 5, stuck: false, piercing: false };
    left.step(240, false, false);
    const leftVx = left.state.balls[0]!.vx;

    const right = createCihlobijec('padlo-vpravo');
    release(right);
    right.state.paddleX = 240;
    right.state.balls[0] = { x: 270, y: PADDLE_Y - 8, vx: 0, vy: 5, stuck: false, piercing: false };
    right.step(240, false, false);
    const rightVx = right.state.balls[0]!.vx;

    // Dopad vlevo od středu posílá míček doleva a naopak.
    expect(leftVx).toBeLessThan(0);
    expect(rightVx).toBeGreaterThan(0);
  });

  it('míček se od pádla odrazí vždy nahoru', () => {
    const game = createCihlobijec('nahoru');
    release(game);
    game.state.paddleX = 240;
    game.state.balls[0] = { x: 240, y: PADDLE_Y - 8, vx: 2, vy: 6, stuck: false, piercing: false };
    game.step(240, false, false);
    expect(game.state.balls[0]!.vy).toBeLessThan(0);
  });
});

describe('Cihlobijec — spojitá kolize', () => {
  /**
   * Kvůli tomuhle existuje swept test: rychlý míček urazí za krok víc,
   * než je tloušťka cihly, a kontrola překryvu po kroku by ho pustila skrz.
   */
  it('rychlý míček neprolétne cihlou', () => {
    const game = createCihlobijec('tunel');
    release(game);
    const before = game.remaining();

    // Míček těsně pod řadou cihel, letící nahoru rychlostí větší než BRICK_H.
    const brick = game.state.bricks[0]!;
    const brickY = BRICK_TOP + brick.row * BRICK_H;
    game.state.balls[0] = {
      x: brick.col * (FIELD_W / 10) + 24,
      y: brickY + BRICK_H + 30,
      vx: 0,
      vy: -60,
      stuck: false,
      piercing: false,
    };
    game.step(FIELD_W / 2, false, false);

    expect(game.remaining()).toBeLessThan(before);
    expect(game.state.balls[0]!.vy).toBeGreaterThan(0);
  });

  it('zásah cihly připíše body', () => {
    const game = createCihlobijec('body');
    release(game);
    const brick = game.state.bricks[0]!;
    const brickY = BRICK_TOP + brick.row * BRICK_H;
    game.state.balls[0] = {
      x: brick.col * (FIELD_W / 10) + 24,
      y: brickY + BRICK_H + 10,
      vx: 0, vy: -20, stuck: false, piercing: false,
    };
    const score = game.state.score;
    game.step(FIELD_W / 2, false, false);
    expect(game.state.score).toBeGreaterThan(score);
  });

  it('nerozbitná cihla se jen odrazí a nezmizí', () => {
    const game = createCihlobijec('nerozbitna', 2);
    release(game);
    // Na desce necháme jedinou cihlu, aby test měřil právě ji a míček
    // cestou nenarazil do ničeho jiného.
    game.state.bricks = [{
      col: 4, row: 0, hits: Number.POSITIVE_INFINITY, solid: true, powerup: null,
    }];

    const brickY = BRICK_TOP + 0 * BRICK_H;
    game.state.balls[0] = {
      x: 4 * (FIELD_W / 10) + 24,
      y: brickY + BRICK_H + 10,
      vx: 0, vy: -20, stuck: false, piercing: false,
    };
    game.step(FIELD_W / 2, false, false);

    expect(game.state.bricks.filter((b) => b.solid)).toHaveLength(1);
    expect(game.state.balls[0]!.vy).toBeGreaterThan(0);
  });

  it('míček, který začne uvnitř cihly, se vytlačí ven a nezasekne se', () => {
    const game = createCihlobijec('uvnitr');
    release(game);
    game.state.bricks = [{
      col: 4, row: 0, hits: 3, solid: true, powerup: null,
    }];
    // Míček přesně uprostřed cihly — situace, která může vzniknout po
    // chycení vylepšení nebo po restartu úrovně.
    game.state.balls[0] = {
      x: 4 * (FIELD_W / 10) + BRICK_W_TEST / 2,
      y: BRICK_TOP + BRICK_H / 2,
      vx: 1.5, vy: -4, stuck: false, piercing: false,
    };

    for (let i = 0; i < 30; i++) game.step(FIELD_W / 2, false, false);
    const ball = game.state.balls[0]!;
    const insideX = ball.x > 4 * (FIELD_W / 10) && ball.x < 5 * (FIELD_W / 10);
    const insideY = ball.y > BRICK_TOP && ball.y < BRICK_TOP + BRICK_H;
    expect(insideX && insideY).toBe(false);
  });
});

describe('Cihlobijec — životy a vylepšení', () => {
  it('ztráta míčku ubere život a vrátí míček na pádlo', () => {
    const game = createCihlobijec('zivot');
    release(game);
    game.state.balls[0] = { x: 240, y: FIELD_H + 20, vx: 0, vy: 6, stuck: false, piercing: false };
    game.step(FIELD_W / 2, false, false);
    expect(game.state.lives).toBe(2);
    expect(game.state.balls[0]!.stuck).toBe(true);
  });

  it('poslední ztracený míček znamená konec', () => {
    const game = createCihlobijec('konec');
    game.state.lives = 1;
    release(game);
    game.state.balls[0] = { x: 240, y: FIELD_H + 20, vx: 0, vy: 6, stuck: false, piercing: false };
    game.step(FIELD_W / 2, false, false);
    expect(game.state.over).toBe(true);
  });

  it('chycené vylepšení se projeví a po čase vyprší', () => {
    const game = createCihlobijec('vylepseni');
    release(game);
    const baseWidth = game.state.paddleW;
    game.state.powerups = [{ x: game.state.paddleX, y: PADDLE_Y - 6, kind: 'siroke-padlo' }];
    game.step(game.state.paddleX, false, false);
    expect(game.state.paddleW).toBeGreaterThan(baseWidth);

    game.state.effects['siroke-padlo'] = 1;
    game.step(game.state.paddleX, false, false);
    expect(game.state.paddleW).toBe(baseWidth);
  });

  it('vylepšení „víc míčků" přidá míčky', () => {
    const game = createCihlobijec('vic-micku');
    release(game);
    run(game, 2);
    game.state.powerups = [{ x: game.state.paddleX, y: PADDLE_Y - 6, kind: 'vic-micku' }];
    game.step(game.state.paddleX, false, false);
    expect(game.state.balls.length).toBeGreaterThan(1);
  });

  it('průrazný míček se od cihly neodrazí', () => {
    const game = createCihlobijec('prurazny');
    release(game);
    const brick = game.state.bricks.find((b) => !b.solid)!;
    const brickY = BRICK_TOP + brick.row * BRICK_H;
    game.state.balls[0] = {
      x: brick.col * (FIELD_W / 10) + 24,
      y: brickY + BRICK_H + 10,
      vx: 0, vy: -20, stuck: false, piercing: true,
    };
    game.step(FIELD_W / 2, false, false);
    expect(game.state.balls[0]!.vy).toBeLessThan(0);
  });

  it('pádlo nevyjede mimo hrací plochu', () => {
    const game = createCihlobijec('padlo-meze');
    run(game, 30, -500);
    expect(game.state.paddleX - game.state.paddleW / 2).toBeGreaterThanOrEqual(-0.01);
    run(game, 60, FIELD_W + 500);
    expect(game.state.paddleX + game.state.paddleW / 2).toBeLessThanOrEqual(FIELD_W + 0.01);
  });

  it('vyčištěná úroveň posune hru dál', () => {
    const game = createCihlobijec('dalsi-uroven');
    const level = game.state.level;
    for (const brick of game.state.bricks) {
      if (!brick.solid) brick.hits = 0;
    }
    game.step(FIELD_W / 2, false, false);
    expect(game.state.level === level + 1 || game.state.won).toBe(true);
  });

  it('laser střílí jen s aktivním vylepšením', () => {
    const game = createCihlobijec('laser');
    release(game);
    game.step(FIELD_W / 2, false, true);
    expect(game.state.lasers).toHaveLength(0);

    game.state.effects.laser = 600;
    game.step(FIELD_W / 2, false, true);
    expect(game.state.lasers).toHaveLength(1);
  });
});
