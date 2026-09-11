/**
 * API portálu VeVit Games.
 *
 * Běží na VPS za Caddy. Nic z toho, co sem přijde od klienta, se nebere
 * jako pravda: skóre se ověřuje přehráním, odpovědi slovních her server
 * nikdy neposílá a přezdívky procházejí filtrem.
 */

import Fastify from 'fastify';
import { createRng } from '@vevit-games/engine/core';
import { config } from './config.js';
import { createMemoryStore, type Store } from './db/store.js';
import { registerRunRoutes } from './routes/runs.js';
import { registerDailyRoutes } from './routes/daily.js';
import { registerLeaderboardRoutes } from './routes/leaderboards.js';
import { issueRealtimeTicket, userFromRequest } from './auth/session.js';
import { guestNickname, validateNickname } from './nickname.js';

/** Jednoduchý rate limit v paměti: klouzavé okno na IP a cestu. */
function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    // Mapa by jinak rostla donekonečna.
    if (hits.size > 10_000) {
      for (const [k, times] of hits) {
        if (times.every((t) => now - t >= windowMs)) hits.delete(k);
      }
    }
    return recent.length <= limit;
  };
}

export function buildServer(store: Store = createMemoryStore()) {
  const app = Fastify({
    logger: config.isProduction ? true : { transport: undefined },
    // Chrání proti zahlcení tělem požadavku.
    bodyLimit: 1024 * 1024,
    trustProxy: true,
  });

  const generalLimit = createRateLimiter(120, 60_000);
  const writeLimit = createRateLimiter(30, 60_000);

  app.addHook('onRequest', async (request, reply) => {
    // Origin ochrana pro nasazení za cizím reverse proxy (D-002).
    if (config.originKey && request.url !== '/healthz') {
      if (request.headers['x-vevit-origin-key'] !== config.originKey) {
        return reply.code(403).send({ error: 'Přímý přístup není povolený.' });
      }
    }

    const ip = request.ip;
    const isWrite = request.method !== 'GET' && request.method !== 'HEAD';
    const allowed = isWrite ? writeLimit(`${ip}:w`) : generalLimit(ip);
    if (!allowed) {
      return reply.code(429).send({ error: 'Moc požadavků. Zkus to za chvíli.' });
    }
  });

  app.get('/healthz', async () => ({
    status: 'ok',
    db: config.databaseUrl ? 'ok' : 'pamet',
    redis: config.redisUrl ? 'ok' : 'vypnuto',
  }));

  app.get('/api/games', async () => ({
    games: ['kostkopad', 'petipismenka', 'zdvojka', 'had', 'hledac-min'],
  }));

  app.get('/api/online', async () => ({}));

  registerRunRoutes(app, store);
  registerDailyRoutes(app, store);
  registerLeaderboardRoutes(app, store);

  /**
   * Ticket pro připojení k realtime serveru (zadání 3.1).
   * Platí 60 s, je jednorázový a realtime navíc kontroluje Origin.
   */
  app.post('/api/rt-ticket', async (request, reply) => {
    const user = await userFromRequest(store, request.headers.cookie);
    const nickname = user?.nickname ?? guestNickname(createRng(`host:${request.ip}:${Date.now()}`));

    return reply.send({
      ticket: issueRealtimeTicket({
        userId: user?.id ?? null,
        nickname,
        issuedAt: Date.now(),
      }),
      url: process.env.RT_PUBLIC_URL ?? 'ws://localhost:3002/ws',
      expiresInSeconds: config.rtTicketTtlSeconds,
    });
  });

  app.post<{ Body: { nickname?: string } }>('/api/profile/nickname', async (request, reply) => {
    const user = await userFromRequest(store, request.headers.cookie);
    if (!user) return reply.code(401).send({ error: 'Chybí přihlášení.' });

    const check = validateNickname(request.body?.nickname ?? '');
    if (!check.ok) return reply.code(400).send({ error: check.reason });
    return reply.send({ nickname: check.value });
  });

  app.setNotFoundHandler(async (_request, reply) =>
    reply.code(404).send({ error: 'Takový endpoint tu není.' }),
  );

  app.setErrorHandler(async (error, request, reply) => {
    request.log.error(error);
    // Podrobnosti chyby ven nepatří — mohly by prozradit vnitřní stav.
    return reply.code(500).send({ error: 'Na serveru se něco pokazilo.' });
  });

  return app;
}

// Spuštění jen při přímém běhu, ne při importu v testech.
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  const app = buildServer();
  app.listen({ port: config.port, host: '0.0.0.0' }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
