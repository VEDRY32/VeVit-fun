/** Žebříčky — veřejné čtení, zápis jen přes ověřený běh. */

import type { FastifyInstance } from 'fastify';
import type { Store, Period } from '../db/store.js';
import { userFromRequest } from '../auth/session.js';

const PERIODS: Period[] = ['dnes', 'tyden', 'navzdy'];
const LIMIT = 50;

export function registerLeaderboardRoutes(app: FastifyInstance, store: Store): void {
  app.get<{ Params: { slug: string }; Querystring: { mode?: string } }>(
    '/api/leaderboards/:slug',
    async (request, reply) => {
      const { slug } = request.params;
      const mode = request.query.mode ?? 'klasik';

      const user = await userFromRequest(store, request.headers.cookie);

      const entries = Object.fromEntries(
        await Promise.all(
          PERIODS.map(async (period) => {
            const rows = await store.leaderboard(slug, mode, period, LIMIT);
            return [
              period,
              // userId se ven neposílá — ven jde jen přezdívka a příznak „to jsem já".
              rows.map((row) => ({
                rank: row.rank,
                nickname: row.nickname,
                score: row.score,
                isMe: user != null && row.userId === user.id,
              })),
            ];
          }),
        ),
      );

      return reply.send(entries);
    },
  );
}
