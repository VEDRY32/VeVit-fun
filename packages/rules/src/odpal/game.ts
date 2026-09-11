/**
 * Odpal — pálky, míček a úhel odrazu podle místa dopadu.
 *
 * Podporuje dva hráče proti sobě i čtyři ve čtverci. AI má tři úrovně,
 * které se liší reakční dobou a chybou v odhadu, ne rychlostí pálky —
 * neporazitelná pálka není zábavná.
 */

import { createRng, type Rng } from '@vevit-games/engine/core';

export const ODPAL_RULES_VERSION = 1;

export const FIELD_W = 640;
export const FIELD_H = 400;

export const PADDLE_LEN = 76;
export const PADDLE_THICK = 12;
const PADDLE_MARGIN = 24;
const PADDLE_SPEED = 6.2;

export const BALL_RADIUS = 7;
const BALL_SPEED_START = 5;
const BALL_SPEED_MAX = 12;
const SPEED_UP = 1.045;
/** Nejostřejší úhel odrazu; kolmý odraz by zasekl výměnu donekonečna. */
const MAX_ANGLE = (Math.PI / 180) * 58;

export type Side = 'vlevo' | 'vpravo' | 'nahore' | 'dole';
export type Difficulty = 'lehka' | 'stredni' | 'tezka';
export type OdpalMode = 'proti-pocitaci' | 'dva-hraci' | 'ctyri';

export interface Paddle {
  side: Side;
  /** Střed pálky na její ose. */
  position: number;
  score: number;
  ai: Difficulty | null;
  alive: boolean;
  /**
   * Chyba v odhadu dopadu, kterou si AI drží po celou výměnu.
   *
   * Kdyby se losovala každý krok, průměrovala by se k nule a i „lehká"
   * AI by byla neprůstřelná — přesně to odhalily testy.
   */
  aimError: number;
  /** Směr letu, pro který chyba platí; při změně se losuje znovu. */
  aimSign: number;
}

export interface OdpalState {
  paddles: Paddle[];
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  /** Krátká pauza po bodu, než míček znovu vyletí. */
  serveTimer: number;
  /** Kdo dostal poslední bod — od něj se podává. */
  lastScorer: Side | null;
  rallies: number;
  tick: number;
  over: boolean;
  winner: Side | null;
}

export interface OdpalGame {
  readonly state: OdpalState;
  readonly rulesVersion: number;
  readonly mode: OdpalMode;
  /** Jeden krok logiky. `inputs` je směr pohybu pálky (-1, 0, 1) podle strany. */
  step(inputs: Partial<Record<Side, number>>): void;
  paddleRect(paddle: Paddle): { x: number; y: number; w: number; h: number };
}

const WIN_SCORE = 11;

/** Osa, po které se pálka pohybuje. */
const isVertical = (side: Side): boolean => side === 'vlevo' || side === 'vpravo';

export function createOdpal(
  seed: string,
  mode: OdpalMode = 'proti-pocitaci',
  difficulty: Difficulty = 'stredni',
): OdpalGame {
  const rng: Rng = createRng(seed);

  const sides: Side[] = mode === 'ctyri'
    ? ['vlevo', 'vpravo', 'nahore', 'dole']
    : ['vlevo', 'vpravo'];

  const state: OdpalState = {
    paddles: sides.map((side) => ({
      side,
      position: isVertical(side) ? FIELD_H / 2 : FIELD_W / 2,
      score: 0,
      // Ve hře proti počítači ovládá hráč levou pálku, zbytek je AI.
      ai: mode === 'dva-hraci' ? null : side === 'vlevo' ? null : difficulty,
      alive: true,
      aimError: 0,
      aimSign: 0,
    })),
    ballX: FIELD_W / 2,
    ballY: FIELD_H / 2,
    vx: 0,
    vy: 0,
    serveTimer: 60,
    lastScorer: null,
    rallies: 0,
    tick: 0,
    over: false,
    winner: null,
  };

  const paddleRect = (paddle: Paddle): { x: number; y: number; w: number; h: number } => {
    switch (paddle.side) {
      case 'vlevo':
        return { x: PADDLE_MARGIN, y: paddle.position - PADDLE_LEN / 2, w: PADDLE_THICK, h: PADDLE_LEN };
      case 'vpravo':
        return { x: FIELD_W - PADDLE_MARGIN - PADDLE_THICK, y: paddle.position - PADDLE_LEN / 2, w: PADDLE_THICK, h: PADDLE_LEN };
      case 'nahore':
        return { x: paddle.position - PADDLE_LEN / 2, y: PADDLE_MARGIN, w: PADDLE_LEN, h: PADDLE_THICK };
      case 'dole':
        return { x: paddle.position - PADDLE_LEN / 2, y: FIELD_H - PADDLE_MARGIN - PADDLE_THICK, w: PADDLE_LEN, h: PADDLE_THICK };
    }
  };

  const serve = (): void => {
    state.ballX = FIELD_W / 2;
    state.ballY = FIELD_H / 2;
    // Podává se směrem k tomu, kdo bod dostal — má šanci se vrátit.
    const angle = rng.range(-MAX_ANGLE / 2, MAX_ANGLE / 2);
    const towardsLeft = state.lastScorer === 'vpravo' || rng.chance(0.5);
    state.vx = Math.cos(angle) * BALL_SPEED_START * (towardsLeft ? -1 : 1);
    state.vy = Math.sin(angle) * BALL_SPEED_START;
    state.rallies = 0;
  };

  const speed = (): number => Math.hypot(state.vx, state.vy);

  /**
   * Cíl AI: kam míček doletí. Odhad je zatížený chybou podle obtížnosti,
   * takže lehká AI mine, i když má stejně rychlou pálku.
   */
  const aiTarget = (paddle: Paddle, level: Difficulty): number => {
    const errorRange = { lehka: 52, stredni: 22, tezka: 7 }[level];
    const reaction = { lehka: 0.35, stredni: 0.75, tezka: 1 }[level];

    // Chyba se losuje jednou za výměnu — při každém obratu míčku.
    const sign = isVertical(paddle.side) ? Math.sign(state.vx) : Math.sign(state.vy);
    if (sign !== paddle.aimSign) {
      paddle.aimSign = sign;
      paddle.aimError = rng.range(-errorRange, errorRange);
    }
    const error = paddle.aimError;

    if (isVertical(paddle.side)) {
      const approaching = paddle.side === 'vlevo' ? state.vx < 0 : state.vx > 0;
      // Když míček letí pryč, AI se jen vrací doprostřed.
      if (!approaching) return FIELD_H / 2;
      const distance = Math.abs(
        (paddle.side === 'vlevo' ? PADDLE_MARGIN : FIELD_W - PADDLE_MARGIN) - state.ballX,
      );
      const ticks = state.vx === 0 ? 0 : distance / Math.abs(state.vx);
      const predicted = state.ballY + state.vy * ticks * reaction;
      // Odraz od stěn: složíme dráhu do výšky pole.
      const bounced = Math.abs(predicted % (FIELD_H * 2));
      const folded = bounced > FIELD_H ? FIELD_H * 2 - bounced : bounced;
      return folded + error;
    }

    const approaching = paddle.side === 'nahore' ? state.vy < 0 : state.vy > 0;
    if (!approaching) return FIELD_W / 2;
    const distance = Math.abs(
      (paddle.side === 'nahore' ? PADDLE_MARGIN : FIELD_H - PADDLE_MARGIN) - state.ballY,
    );
    const ticks = state.vy === 0 ? 0 : distance / Math.abs(state.vy);
    const predicted = state.ballX + state.vx * ticks * reaction;
    const bounced = Math.abs(predicted % (FIELD_W * 2));
    const folded = bounced > FIELD_W ? FIELD_W * 2 - bounced : bounced;
    return folded + rng.range(-error, error);
  };

  const bounceOff = (paddle: Paddle): void => {
    const rect = paddleRect(paddle);
    const next = Math.min(BALL_SPEED_MAX, speed() * SPEED_UP);
    state.rallies++;

    if (isVertical(paddle.side)) {
      const offset = (state.ballY - paddle.position) / (PADDLE_LEN / 2);
      const angle = Math.max(-1, Math.min(1, offset)) * MAX_ANGLE;
      const direction = paddle.side === 'vlevo' ? 1 : -1;
      state.vx = Math.cos(angle) * next * direction;
      state.vy = Math.sin(angle) * next;
      state.ballX = paddle.side === 'vlevo'
        ? rect.x + rect.w + BALL_RADIUS + 0.5
        : rect.x - BALL_RADIUS - 0.5;
      return;
    }

    const offset = (state.ballX - paddle.position) / (PADDLE_LEN / 2);
    const angle = Math.max(-1, Math.min(1, offset)) * MAX_ANGLE;
    const direction = paddle.side === 'nahore' ? 1 : -1;
    state.vy = Math.cos(angle) * next * direction;
    state.vx = Math.sin(angle) * next;
    state.ballY = paddle.side === 'nahore'
      ? rect.y + rect.h + BALL_RADIUS + 0.5
      : rect.y - BALL_RADIUS - 0.5;
  };

  const concede = (side: Side): void => {
    // Bod dostanou všichni ostatní — ve čtyřech se tak trestá jen ten,
    // kdo míček pustil.
    for (const paddle of state.paddles) {
      if (paddle.side !== side) paddle.score++;
    }
    state.lastScorer = side;
    state.serveTimer = 50;

    const leader = state.paddles.reduce((a, b) => (b.score > a.score ? b : a));
    if (leader.score >= WIN_SCORE) {
      state.over = true;
      state.winner = leader.side;
    }
  };

  serve();

  return {
    state,
    mode,
    rulesVersion: ODPAL_RULES_VERSION,
    paddleRect,

    step(inputs) {
      if (state.over) return;
      state.tick++;

      if (state.serveTimer > 0) {
        state.serveTimer--;
        if (state.serveTimer === 0) serve();
        // Pálky se smí srovnávat i během pauzy.
      }

      // --- Pálky ---
      for (const paddle of state.paddles) {
        const axisLength = isVertical(paddle.side) ? FIELD_H : FIELD_W;
        let direction = inputs[paddle.side] ?? 0;

        if (paddle.ai) {
          const target = aiTarget(paddle, paddle.ai);
          const diff = target - paddle.position;
          // Mrtvá zóna, aby pálka nekmitala kolem cíle.
          direction = Math.abs(diff) < 6 ? 0 : Math.sign(diff);
        }

        paddle.position += direction * PADDLE_SPEED;
        paddle.position = Math.max(
          PADDLE_LEN / 2,
          Math.min(axisLength - PADDLE_LEN / 2, paddle.position),
        );
      }

      if (state.serveTimer > 0) return;

      // --- Míček ---
      state.ballX += state.vx;
      state.ballY += state.vy;

      const hasTopBottom = mode === 'ctyri';
      if (!hasTopBottom) {
        // Ve dvou hráčích jsou vodorovné stěny odrazné.
        if (state.ballY - BALL_RADIUS < 0) {
          state.ballY = BALL_RADIUS;
          state.vy = Math.abs(state.vy);
        } else if (state.ballY + BALL_RADIUS > FIELD_H) {
          state.ballY = FIELD_H - BALL_RADIUS;
          state.vy = -Math.abs(state.vy);
        }
      }

      for (const paddle of state.paddles) {
        const rect = paddleRect(paddle);
        const hit = state.ballX + BALL_RADIUS >= rect.x
          && state.ballX - BALL_RADIUS <= rect.x + rect.w
          && state.ballY + BALL_RADIUS >= rect.y
          && state.ballY - BALL_RADIUS <= rect.y + rect.h;
        if (!hit) continue;

        // Odraz jen když míček k pálce opravdu letí — jinak by se zasekl uvnitř.
        const incoming = isVertical(paddle.side)
          ? (paddle.side === 'vlevo' ? state.vx < 0 : state.vx > 0)
          : (paddle.side === 'nahore' ? state.vy < 0 : state.vy > 0);
        if (incoming) bounceOff(paddle);
      }

      // --- Body ---
      if (state.ballX < -BALL_RADIUS * 2) concede('vlevo');
      else if (state.ballX > FIELD_W + BALL_RADIUS * 2) concede('vpravo');
      else if (hasTopBottom && state.ballY < -BALL_RADIUS * 2) concede('nahore');
      else if (hasTopBottom && state.ballY > FIELD_H + BALL_RADIUS * 2) concede('dole');
    },
  };
}

export { WIN_SCORE };
