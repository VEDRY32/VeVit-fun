/**
 * Klient k API.
 *
 * Portál musí fungovat i offline: když API nedosáhneme, hra běží dál
 * a skóre zůstane jen v lokálních rekordech. Žádná hra se kvůli síti nezastaví.
 */

import type { ScoreApi, ScoreHandle, SubmitResult, SubmitResponse, GameStorage } from '@vevit-games/engine';
import type { LeaderboardEntry, LeaderboardPeriod } from '@vevit-games/ui';

const BASE = '/api';
const TIMEOUT_MS = 6000;

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        ...init?.headers,
      },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // Offline, timeout nebo API mimo provoz — volající si poradí bez dat.
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Náhodný seed pro nehodnocený nebo offline běh. */
function localSeed(slug: string, mode: string): string {
  const random = crypto.getRandomValues(new Uint32Array(2));
  return `local:${slug}:${mode}:${random[0]!.toString(36)}${random[1]!.toString(36)}`;
}

export function createScoreApi(
  slug: string,
  storage: GameStorage,
  scoringByMode: Record<string, 'high' | 'low'>,
): ScoreApi {
  let handle: ScoreHandle | null = null;

  return {
    async start(mode) {
      const result = await request<{ runId: string; seed: string }>(`/runs/start`, {
        method: 'POST',
        body: JSON.stringify({ gameSlug: slug, mode }),
      });
      handle = result
        ? { runId: result.runId, seed: result.seed }
        : { runId: null, seed: localSeed(slug, mode) };
      return handle;
    },

    async submit(result: SubmitResult): Promise<SubmitResponse> {
      const scoring = scoringByMode[result.mode] ?? 'high';
      const personalBest = storage.recordBest(result.mode, result.score, scoring);

      // Bez run_id nemá server co ověřovat — běh zůstane jen lokální.
      if (!result.runId && !handle?.runId) {
        return { accepted: false, personalBest, reason: 'Běh není hodnocený.' };
      }

      const response = await request<SubmitResponse>(`/runs/submit`, {
        method: 'POST',
        body: JSON.stringify({
          runId: result.runId ?? handle?.runId,
          gameSlug: slug,
          mode: result.mode,
          score: result.score,
          durationMs: result.durationMs,
          stats: result.stats ?? {},
          // Replay jde v base64; JSON binární data neumí.
          replay: result.replay ? encodeBase64(result.replay) : undefined,
        }),
      });

      if (!response) {
        return {
          accepted: false,
          personalBest,
          reason: 'Server je nedostupný. Rekord máme uložený u tebe.',
        };
      }
      return { ...response, personalBest: response.personalBest || personalBest };
    },

    localBest: (mode) => storage.getBest(mode),
  };
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  // Po částech, ať u dlouhého replaye nespadne `apply` na limit argumentů.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export type LeaderboardData = Record<LeaderboardPeriod, LeaderboardEntry[]>;

export const EMPTY_LEADERBOARD: LeaderboardData = { dnes: [], tyden: [], navzdy: [] };

export async function fetchLeaderboard(slug: string, mode: string): Promise<LeaderboardData> {
  const result = await request<LeaderboardData>(
    `/leaderboards/${encodeURIComponent(slug)}?mode=${encodeURIComponent(mode)}`,
  );
  return result ?? EMPTY_LEADERBOARD;
}

export interface OnlineCounts {
  [slug: string]: number;
}

export async function fetchOnlineCounts(): Promise<OnlineCounts> {
  return (await request<OnlineCounts>('/online')) ?? {};
}
