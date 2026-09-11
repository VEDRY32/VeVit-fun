/**
 * Hodnocené běhy (zadání 3.4).
 *
 * Server přiděluje seed, takže hráč si nemůže vybrat snadné zadání, a na
 * konci běh přehraje ze záznamu vstupů. Bez shody skóre se nic nezapíše.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { validateRun, REPLAYABLE } from '@vevit-games/rules';
import type { Store } from '../db/store.js';
import { userFromRequest } from '../auth/session.js';

/** Maximální velikost replaye. Delší běh je buď chyba, nebo pokus o zahlcení. */
const MAX_REPLAY_BYTES = 512 * 1024;

/** Jeden hráč nesmí mít víc rozpracovaných hodnocených běhů naráz. */
const MAX_PENDING_RUNS = 1;

/** Sanity limity pro hry, které replay přehrát neumíme. */
const SANITY: Record<string, { maxPointsPerSecond: number; minDurationMs: number }> = {
  zdvojka: { maxPointsPerSecond: 400, minDurationMs: 5_000 },
  had: { maxPointsPerSecond: 60, minDurationMs: 3_000 },
  'hledac-min': { maxPointsPerSecond: Number.POSITIVE_INFINITY, minDurationMs: 1_000 },
  petipismenka: { maxPointsPerSecond: Number.POSITIVE_INFINITY, minDurationMs: 2_000 },
};

interface StartBody {
  gameSlug?: string;
  mode?: string;
}

interface SubmitBody {
  runId?: string;
  gameSlug?: string;
  mode?: string;
  score?: number;
  durationMs?: number;
  replay?: string;
  stats?: Record<string, number>;
}

export function registerRunRoutes(app: FastifyInstance, store: Store): void {
  app.post('/api/runs/start', async (request, reply) => {
    const body = (request.body ?? {}) as StartBody;
    if (!body.gameSlug || !body.mode) {
      return reply.code(400).send({ error: 'Chybí gameSlug nebo mode.' });
    }

    const user = await userFromRequest(store, request.headers.cookie);
    if (!user) {
      // Hosté hrát můžou, ale do žebříčku se nezapisují (zadání 3.1).
      return reply.code(401).send({ error: 'Hodnocený běh vyžaduje přihlášení.' });
    }

    const pending = await store.countPendingRuns(user.id, body.gameSlug, body.mode);
    if (pending >= MAX_PENDING_RUNS) {
      return reply.code(409).send({
        error: 'Máš rozehraný jiný hodnocený běh. Dohraj ho, nebo počkej, než vyprší.',
      });
    }

    const runId = randomUUID();
    // Seed obsahuje run_id, takže ho nejde znovu použít v jiném běhu.
    const seed = `run:${body.gameSlug}:${body.mode}:${runId}`;

    await store.createRun({
      id: runId,
      userId: user.id,
      gameSlug: body.gameSlug,
      mode: body.mode,
      seed,
      score: 0,
      durationMs: 0,
      status: 'pending',
    });

    return reply.send({ runId, seed });
  });

  app.post('/api/runs/submit', async (request, reply) => {
    const body = (request.body ?? {}) as SubmitBody;
    if (!body.runId || typeof body.score !== 'number' || typeof body.durationMs !== 'number') {
      return reply.code(400).send({ error: 'Neúplný výsledek.' });
    }
    if (!Number.isFinite(body.score) || !Number.isFinite(body.durationMs)) {
      return reply.code(400).send({ error: 'Skóre ani délka nesmí být nekonečno.' });
    }

    const user = await userFromRequest(store, request.headers.cookie);
    if (!user) return reply.code(401).send({ error: 'Chybí přihlášení.' });

    const run = await store.getRun(body.runId);
    if (!run) return reply.code(404).send({ error: 'Takový běh neznáme.' });

    // Bez téhle kontroly by šlo odeslat výsledek do cizího běhu (IDOR).
    if (run.userId !== user.id) {
      return reply.code(403).send({ error: 'Tenhle běh ti nepatří.' });
    }
    if (run.status !== 'pending') {
      return reply.code(409).send({ error: 'Tenhle běh je už uzavřený.' });
    }

    let replay: Uint8Array | undefined;
    if (body.replay) {
      const buffer = Buffer.from(body.replay, 'base64');
      if (buffer.length > MAX_REPLAY_BYTES) {
        await store.finishRun(run.id, {
          score: 0, durationMs: body.durationMs,
          status: 'rejected', rejectReason: 'Replay je příliš velký.',
        });
        return reply.code(413).send({ accepted: false, personalBest: false, reason: 'Replay je příliš velký.' });
      }
      replay = new Uint8Array(buffer);
    }

    // 1) Hry, které umíme přehrát — rozhoduje shoda skóre.
    if (REPLAYABLE.has(run.gameSlug)) {
      if (!replay) {
        await store.finishRun(run.id, {
          score: 0, durationMs: body.durationMs,
          status: 'rejected', rejectReason: 'Chybí replay.',
        });
        return reply.send({ accepted: false, personalBest: false, reason: 'Běh bez replaye nelze uznat.' });
      }

      const verdict = validateRun({
        gameSlug: run.gameSlug,
        mode: run.mode,
        seed: run.seed,
        claimedScore: body.score,
        claimedDurationMs: body.durationMs,
        replay,
      });

      if (verdict.status === 'rejected') {
        await store.finishRun(run.id, {
          score: 0, durationMs: body.durationMs,
          status: 'rejected', rejectReason: verdict.reason,
        });
        request.log.warn({ runId: run.id, userId: user.id, reason: verdict.reason }, 'běh zamítnut');
        return reply.send({ accepted: false, personalBest: false, reason: 'Skóre se nepodařilo ověřit.' });
      }

      if (verdict.status === 'validated') {
        await store.finishRun(run.id, {
          score: verdict.score, durationMs: body.durationMs, status: 'validated',
        });
        await store.recordLeaderboardEntry(
          run.gameSlug, run.mode, user.id, user.nickname, verdict.score, 'high',
        );
        const board = await store.leaderboard(run.gameSlug, run.mode, 'dnes', 100);
        const rank = board.find((row) => row.userId === user.id)?.rank;
        return reply.send({ accepted: true, personalBest: true, rank });
      }
    }

    // 2) Ostatní hry — sanity limity a označení odlehlých hodnot k ruční kontrole.
    const limits = SANITY[run.gameSlug];
    const seconds = Math.max(1, body.durationMs / 1000);
    const suspicious =
      limits != null &&
      (body.durationMs < limits.minDurationMs || body.score / seconds > limits.maxPointsPerSecond);

    await store.finishRun(run.id, {
      score: body.score,
      durationMs: body.durationMs,
      status: suspicious ? 'flagged' : 'validated',
      rejectReason: suspicious ? 'Mimo očekávané meze — k ruční kontrole.' : undefined,
    });

    if (suspicious) {
      request.log.warn({ runId: run.id, userId: user.id, score: body.score }, 'běh označen');
      return reply.send({
        accepted: false, personalBest: false,
        reason: 'Výsledek čeká na kontrolu.',
      });
    }

    await store.recordLeaderboardEntry(
      run.gameSlug, run.mode, user.id, user.nickname, body.score, 'high',
    );
    const board = await store.leaderboard(run.gameSlug, run.mode, 'dnes', 100);
    return reply.send({
      accepted: true,
      personalBest: true,
      rank: board.find((row) => row.userId === user.id)?.rank,
    });
  });
}
