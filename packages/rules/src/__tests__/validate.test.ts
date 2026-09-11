import { describe, it, expect } from 'vitest';
import { createReplayRecorder } from '@vevit-games/engine';
import { validateRun } from '../validate.js';
import { createKostkopad } from '../kostkopad/game.js';
import { KOSTKOPAD_RULES_VERSION } from '../kostkopad/scoring.js';
import { BIT } from '../input-bits.js';

const SEED = 'validace:2026-09-11';

/** Odehraje běh a vrátí, co by klient poslal na server. */
function playRun(seed = SEED, mode = 'maraton', ticks = 1200) {
  const game = createKostkopad(seed, { mode: mode as 'maraton' });
  const recorder = createReplayRecorder({
    gameSlug: 'kostkopad',
    mode,
    seed,
    rulesVersion: KOSTKOPAD_RULES_VERSION,
    clientVersion: '0.1.0',
  });

  // Jednoduchý „bot": střídá posun a tvrdý pád.
  const pattern = [BIT.left, 0, BIT.up, 0, BIT.a, 0, BIT.right, 0, 0, 0];
  for (let i = 0; i < ticks; i++) {
    const mask = pattern[i % pattern.length]!;
    recorder.record(mask);
    game.step(mask);
  }

  return {
    replay: recorder.finish(),
    score: game.state.score,
    durationMs: Math.round((ticks * 1000) / 60),
  };
}

describe('validateRun', () => {
  it('uzná poctivý běh', () => {
    const run = playRun();
    const verdict = validateRun({
      gameSlug: 'kostkopad',
      mode: 'maraton',
      seed: SEED,
      claimedScore: run.score,
      claimedDurationMs: run.durationMs,
      replay: run.replay,
    });
    expect(verdict).toEqual({ status: 'validated', score: run.score });
  });

  it('zamítne nafouknuté skóre', () => {
    const run = playRun();
    const verdict = validateRun({
      gameSlug: 'kostkopad',
      mode: 'maraton',
      seed: SEED,
      claimedScore: run.score + 999_999,
      claimedDurationMs: run.durationMs,
      replay: run.replay,
    });
    expect(verdict.status).toBe('rejected');
    expect(verdict.status === 'rejected' && verdict.reason).toMatch(/Skóre nesedí/);
  });

  it('zamítne replay z jiného seedu', () => {
    const run = playRun();
    const verdict = validateRun({
      gameSlug: 'kostkopad',
      mode: 'maraton',
      seed: 'jiny-seed',
      claimedScore: run.score,
      claimedDurationMs: run.durationMs,
      replay: run.replay,
    });
    expect(verdict.status).toBe('rejected');
    expect(verdict.status === 'rejected' && verdict.reason).toMatch(/seed/);
  });

  it('zamítne replay z jiného režimu', () => {
    const run = playRun();
    const verdict = validateRun({
      gameSlug: 'kostkopad',
      mode: 'ultra',
      seed: SEED,
      claimedScore: run.score,
      claimedDurationMs: run.durationMs,
      replay: run.replay,
    });
    expect(verdict.status).toBe('rejected');
    expect(verdict.status === 'rejected' && verdict.reason).toMatch(/režimu/);
  });

  it('zamítne podvrženou délku běhu', () => {
    const run = playRun();
    const verdict = validateRun({
      gameSlug: 'kostkopad',
      mode: 'maraton',
      seed: SEED,
      claimedScore: run.score,
      claimedDurationMs: run.durationMs + 60_000,
      replay: run.replay,
    });
    expect(verdict.status).toBe('rejected');
    expect(verdict.status === 'rejected' && verdict.reason).toMatch(/Délka/);
  });

  it('zamítne poškozený replay', () => {
    const verdict = validateRun({
      gameSlug: 'kostkopad',
      mode: 'maraton',
      seed: SEED,
      claimedScore: 100,
      claimedDurationMs: 1000,
      replay: new Uint8Array([9, 9, 9, 9]),
    });
    expect(verdict.status).toBe('rejected');
    expect(verdict.status === 'rejected' && verdict.reason).toMatch(/Poškozený/);
  });

  it('u nepodporované hry vrátí unsupported, ne rejected', () => {
    const verdict = validateRun({
      gameSlug: 'pexeso',
      mode: 'klasik',
      seed: SEED,
      claimedScore: 1,
      claimedDurationMs: 1,
      replay: new Uint8Array(),
    });
    expect(verdict.status).toBe('unsupported');
  });

  it('přehrání je reprodukovatelné — dvakrát stejný verdikt', () => {
    const run = playRun();
    const request = {
      gameSlug: 'kostkopad',
      mode: 'maraton',
      seed: SEED,
      claimedScore: run.score,
      claimedDurationMs: run.durationMs,
      replay: run.replay,
    };
    expect(validateRun(request)).toEqual(validateRun(request));
  });
});
