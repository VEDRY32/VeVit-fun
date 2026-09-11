import { describe, it, expect } from 'vitest';
import {
  createOdpal, FIELD_W, FIELD_H, PADDLE_LEN, WIN_SCORE,
  type OdpalGame, type Side,
} from '../game.js';

function idle(game: OdpalGame, n: number, inputs: Partial<Record<Side, number>> = {}): void {
  for (let i = 0; i < n; i++) game.step(inputs);
}

/** Přeskočí pauzu před podáním. */
function skipServe(game: OdpalGame): void {
  while (game.state.serveTimer > 0) game.step({});
}

describe('Odpal — nastavení', () => {
  it('proti počítači má dvě pálky, hráč vlevo', () => {
    const game = createOdpal('proti-ai', 'proti-pocitaci');
    expect(game.state.paddles).toHaveLength(2);
    expect(game.state.paddles.find((p) => p.side === 'vlevo')!.ai).toBeNull();
    expect(game.state.paddles.find((p) => p.side === 'vpravo')!.ai).not.toBeNull();
  });

  it('dva hráči nemají žádnou AI', () => {
    const game = createOdpal('dva', 'dva-hraci');
    expect(game.state.paddles.every((p) => p.ai === null)).toBe(true);
  });

  it('čtyři hráči mají pálky na všech stranách', () => {
    const game = createOdpal('ctyri', 'ctyri');
    expect(game.state.paddles.map((p) => p.side).sort())
      .toEqual(['dole', 'nahore', 'vlevo', 'vpravo']);
  });

  it('stejný seed dá stejné podání', () => {
    const a = createOdpal('stejne');
    const b = createOdpal('stejne');
    expect([a.state.vx, a.state.vy]).toEqual([b.state.vx, b.state.vy]);
  });
});

describe('Odpal — pálky', () => {
  it('vstup posune pálku', () => {
    const game = createOdpal('pohyb', 'dva-hraci');
    const start = game.state.paddles[0]!.position;
    idle(game, 5, { vlevo: 1 });
    expect(game.state.paddles[0]!.position).toBeGreaterThan(start);
  });

  it('pálka nevyjede z hrací plochy', () => {
    const game = createOdpal('meze', 'dva-hraci');
    idle(game, 200, { vlevo: -1 });
    expect(game.state.paddles[0]!.position).toBeGreaterThanOrEqual(PADDLE_LEN / 2);
    idle(game, 400, { vlevo: 1 });
    expect(game.state.paddles[0]!.position).toBeLessThanOrEqual(FIELD_H - PADDLE_LEN / 2);
  });

  it('pálky jde srovnat i během pauzy před podáním', () => {
    const game = createOdpal('pauza', 'dva-hraci');
    const start = game.state.paddles[0]!.position;
    expect(game.state.serveTimer).toBeGreaterThan(0);
    game.step({ vlevo: 1 });
    expect(game.state.paddles[0]!.position).toBeGreaterThan(start);
  });
});

describe('Odpal — míček', () => {
  it('ve dvou hráčích se odrazí od vodorovných stěn', () => {
    const game = createOdpal('stena', 'dva-hraci');
    skipServe(game);
    game.state.ballX = FIELD_W / 2;
    game.state.ballY = 4;
    game.state.vx = 2;
    game.state.vy = -5;
    game.step({});
    expect(game.state.vy).toBeGreaterThan(0);
  });

  it('ve čtyřech hráčích horní stěna body pouští', () => {
    const game = createOdpal('ctyri-stena', 'ctyri');
    skipServe(game);
    game.state.ballX = FIELD_W / 2;
    game.state.ballY = -20;
    game.state.vy = -5;
    game.step({});
    expect(game.state.paddles.find((p) => p.side === 'nahore')!.score).toBe(0);
    expect(game.state.paddles.find((p) => p.side === 'vlevo')!.score).toBe(1);
  });

  it('odraz od pálky závisí na místě dopadu', () => {
    const measure = (offset: number): number => {
      const game = createOdpal('uhel', 'dva-hraci');
      skipServe(game);
      const paddle = game.state.paddles.find((p) => p.side === 'vlevo')!;
      paddle.position = FIELD_H / 2;
      const rect = game.paddleRect(paddle);
      game.state.ballX = rect.x + rect.w + 2;
      game.state.ballY = paddle.position + offset;
      game.state.vx = -5;
      game.state.vy = 0;
      game.step({});
      return game.state.vy;
    };
    expect(measure(-30)).toBeLessThan(0);
    expect(measure(30)).toBeGreaterThan(0);
  });

  it('míček se od pálky vždy odrazí pryč', () => {
    const game = createOdpal('smer', 'dva-hraci');
    skipServe(game);
    const paddle = game.state.paddles.find((p) => p.side === 'vlevo')!;
    const rect = game.paddleRect(paddle);
    game.state.ballX = rect.x + rect.w + 2;
    game.state.ballY = paddle.position;
    game.state.vx = -5;
    game.state.vy = 1;
    game.step({});
    expect(game.state.vx).toBeGreaterThan(0);
  });

  it('výměna míček zrychluje, ale má strop', () => {
    const game = createOdpal('rychlost', 'dva-hraci');
    skipServe(game);
    const paddle = game.state.paddles.find((p) => p.side === 'vlevo')!;

    let previous = Math.hypot(game.state.vx, game.state.vy);
    for (let i = 0; i < 40; i++) {
      const rect = game.paddleRect(paddle);
      game.state.ballX = rect.x + rect.w + 2;
      game.state.ballY = paddle.position;
      game.state.vx = -Math.abs(game.state.vx);
      game.step({});
      const now = Math.hypot(game.state.vx, game.state.vy);
      expect(now).toBeGreaterThanOrEqual(previous - 0.001);
      previous = now;
    }
    expect(previous).toBeLessThanOrEqual(12.01);
  });
});

describe('Odpal — body a konec', () => {
  it('míček za levou pálkou dá bod pravé', () => {
    const game = createOdpal('bod', 'dva-hraci');
    skipServe(game);
    game.state.ballX = -30;
    game.step({});
    expect(game.state.paddles.find((p) => p.side === 'vpravo')!.score).toBe(1);
    expect(game.state.serveTimer).toBeGreaterThan(0);
  });

  it('po bodu se míček vrátí doprostřed', () => {
    const game = createOdpal('podani', 'dva-hraci');
    skipServe(game);
    game.state.ballX = -30;
    game.step({});
    skipServe(game);
    // `skipServe` doběhne až po kroku, ve kterém se podává, takže míček
    // už je o jeden posun dál. Tolerance je proto jedna maximální rychlost.
    expect(Math.abs(game.state.ballX - FIELD_W / 2)).toBeLessThan(13);
    expect(Math.abs(game.state.ballY - FIELD_H / 2)).toBeLessThan(13);
  });

  it('hra končí na jedenácti bodech', () => {
    const game = createOdpal('konec', 'dva-hraci');
    game.state.paddles.find((p) => p.side === 'vpravo')!.score = WIN_SCORE - 1;
    skipServe(game);
    game.state.ballX = -30;
    game.step({});
    expect(game.state.over).toBe(true);
    expect(game.state.winner).toBe('vpravo');
  });

  it('po konci se stav nemění', () => {
    const game = createOdpal('po-konci', 'dva-hraci');
    game.state.over = true;
    const snapshot = JSON.stringify(game.state.paddles.map((p) => p.score));
    idle(game, 60);
    expect(JSON.stringify(game.state.paddles.map((p) => p.score))).toBe(snapshot);
  });
});

describe('Odpal — AI', () => {
  it('těžká AI pustí míň míčků než lehká', () => {
    /**
     * Levou pálku posouváme přímo na výšku míčku, takže je neprůstřelná
     * a měříme opravdu jen chybovost AI. Ovládání vstupem by nestíhalo
     * a mířili bychom vedle: mine hráč, ne AI.
     */
    const measure = (level: 'lehka' | 'tezka'): number => {
      const game = createOdpal(`ai-${level}`, 'proti-pocitaci', level);
      for (let i = 0; i < 6000 && !game.state.over; i++) {
        const left = game.state.paddles.find((p) => p.side === 'vlevo')!;
        left.position = Math.max(
          PADDLE_LEN / 2,
          Math.min(FIELD_H - PADDLE_LEN / 2, game.state.ballY),
        );
        game.step({});
      }
      // Kolikrát AI míček pustila = kolik bodů dostal levý hráč.
      return game.state.paddles.find((p) => p.side === 'vlevo')!.score;
    };

    const hard = measure('tezka');
    const easy = measure('lehka');
    expect(easy).toBeGreaterThan(0);
    expect(hard).toBeLessThan(easy);
  });

  it('AI pálka zůstává v mezích', () => {
    const game = createOdpal('ai-meze', 'proti-pocitaci', 'tezka');
    idle(game, 2000);
    const right = game.state.paddles.find((p) => p.side === 'vpravo')!;
    expect(right.position).toBeGreaterThanOrEqual(PADDLE_LEN / 2);
    expect(right.position).toBeLessThanOrEqual(FIELD_H - PADDLE_LEN / 2);
  });

  it('stejný seed dá stejný průběh', () => {
    const run = (): string => {
      const game = createOdpal('determinismus', 'proti-pocitaci', 'stredni');
      for (let i = 0; i < 800; i++) game.step({ vlevo: i % 60 < 30 ? 1 : -1 });
      return JSON.stringify({
        scores: game.state.paddles.map((p) => p.score),
        ball: [Math.round(game.state.ballX), Math.round(game.state.ballY)],
      });
    };
    expect(run()).toBe(run());
  });
});
