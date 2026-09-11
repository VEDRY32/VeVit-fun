/**
 * Serverová validace hodnocených běhů (D-008).
 *
 * Server hru přehraje ze zaznamenaných vstupů přes stejný modul, jaký běžel
 * u hráče. Když se skóre neshoduje, běh se zamítne. Tohle je jediný důvod,
 * proč je herní logika deterministická — bez toho by se žebříček dal napsat
 * jedním `fetch`em.
 */

import { parseReplay, type Replay } from '@vevit-games/engine';
import { createKostkopad, type KostkopadMode } from './kostkopad/game.js';
import { KOSTKOPAD_RULES_VERSION } from './kostkopad/scoring.js';

export interface ValidationRequest {
  gameSlug: string;
  mode: string;
  seed: string;
  claimedScore: number;
  claimedDurationMs: number;
  replay: Uint8Array;
}

export type ValidationVerdict =
  | { status: 'validated'; score: number }
  | { status: 'rejected'; reason: string }
  /** Běh neumíme přehrát (nedeterministická hra) — posoudí se jinými pravidly. */
  | { status: 'unsupported'; reason: string };

/** Hry, u kterých replay přehrát umíme. */
export const REPLAYABLE = new Set(['kostkopad']);

/** Tolerance délky běhu: klient měří reálný čas, server kroky logiky. */
const DURATION_TOLERANCE_MS = 3000;

export function validateRun(request: ValidationRequest): ValidationVerdict {
  if (!REPLAYABLE.has(request.gameSlug)) {
    return { status: 'unsupported', reason: `Hra ${request.gameSlug} replay validaci nepodporuje.` };
  }

  let replay: Replay;
  try {
    replay = parseReplay(request.replay);
  } catch (error) {
    return { status: 'rejected', reason: `Poškozený replay: ${(error as Error).message}` };
  }

  // Metadata musí sedět s tím, co hráč tvrdí — jinak by šlo poslat replay
  // z jiného, snazšího běhu.
  if (replay.meta.gameSlug !== request.gameSlug) {
    return { status: 'rejected', reason: 'Replay patří jiné hře.' };
  }
  if (replay.meta.mode !== request.mode) {
    return { status: 'rejected', reason: 'Replay patří jinému režimu.' };
  }
  if (replay.meta.seed !== request.seed) {
    return { status: 'rejected', reason: 'Replay má jiný seed, než server přidělil.' };
  }

  switch (request.gameSlug) {
    case 'kostkopad':
      return validateKostkopad(request, replay);
    default:
      return { status: 'unsupported', reason: 'Neznámá hra.' };
  }
}

function validateKostkopad(request: ValidationRequest, replay: Replay): ValidationVerdict {
  if (replay.meta.rulesVersion !== KOSTKOPAD_RULES_VERSION) {
    return {
      status: 'rejected',
      reason: `Replay používá pravidla verze ${replay.meta.rulesVersion}, server má ${KOSTKOPAD_RULES_VERSION}.`,
    };
  }

  const game = createKostkopad(request.seed, { mode: request.mode as KostkopadMode });
  for (const mask of replay.masks) game.step(mask);

  // Sprint se hodnotí časem, ostatní režimy body.
  const replayedScore = request.mode === 'sprint40'
    ? Math.round((replay.masks.length * 1000) / 60)
    : game.state.score;

  if (replayedScore !== request.claimedScore) {
    return {
      status: 'rejected',
      reason: `Skóre nesedí: hráč tvrdí ${request.claimedScore}, přehrání dalo ${replayedScore}.`,
    };
  }

  const replayedDuration = Math.round((replay.masks.length * 1000) / 60);
  if (Math.abs(replayedDuration - request.claimedDurationMs) > DURATION_TOLERANCE_MS) {
    return {
      status: 'rejected',
      reason: `Délka běhu nesedí: ${request.claimedDurationMs} ms vs. ${replayedDuration} ms.`,
    };
  }

  if (request.mode === 'sprint40' && !game.state.won) {
    return { status: 'rejected', reason: 'Sprint nebyl dokončen.' };
  }

  return { status: 'validated', score: replayedScore };
}
