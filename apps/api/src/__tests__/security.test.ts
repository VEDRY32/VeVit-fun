/**
 * Bezpečnostní testy API (fáze F5, průběžně).
 *
 * Každý test popisuje konkrétní útok, ne jen „nějakou chybu".
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildServer } from '../server.js';
import { createMemoryStore, type Store } from '../db/store.js';
import { hashToken, issueRealtimeTicket, verifyRealtimeTicket, verifySignature, sign } from '../auth/session.js';
import { validateNickname, containsProfanity, guestNickname } from '../nickname.js';
import { createRng, createReplayRecorder } from '@vevit-games/engine/core';
import { createKostkopad, KOSTKOPAD_RULES_VERSION, BIT } from '@vevit-games/rules';
import { config } from '../config.js';

/** Vytvoří store s jedním přihlášeným hráčem a vrátí jeho cookie. */
function storeWithUser(id = 'u1', nickname = 'Hráč') {
  const store = createMemoryStore();
  const token = 'testovaci-token';
  // MemoryStore drží sezení v interní mapě; tady ji naplníme přes rozhraní,
  // které test potřebuje.
  (store as Store & { __sessions?: Map<string, unknown> }).getUserBySession = async (hash) =>
    hash === hashToken(token) ? { id, nickname, role: 'player' } : null;
  return { store, cookie: `${config.sessionCookie}=${token}` };
}

describe('API — přístup k běhům', () => {
  let app: ReturnType<typeof buildServer>;
  let store: Store;
  let cookie: string;

  beforeEach(() => {
    ({ store, cookie } = storeWithUser());
    app = buildServer(store);
  });

  it('hodnocený běh bez přihlášení nezaloží', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/runs/start',
      payload: { gameSlug: 'kostkopad', mode: 'maraton' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('seed přiděluje server, ne klient', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/runs/start', headers: { cookie },
      payload: { gameSlug: 'kostkopad', mode: 'maraton', seed: 'muj-lehky-seed' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { seed: string; runId: string };
    expect(body.seed).not.toContain('muj-lehky-seed');
    expect(body.seed).toContain(body.runId);
  });

  it('druhý souběžný hodnocený běh se nezaloží', async () => {
    await app.inject({
      method: 'POST', url: '/api/runs/start', headers: { cookie },
      payload: { gameSlug: 'kostkopad', mode: 'maraton' },
    });
    const second = await app.inject({
      method: 'POST', url: '/api/runs/start', headers: { cookie },
      payload: { gameSlug: 'kostkopad', mode: 'maraton' },
    });
    expect(second.statusCode).toBe(409);
  });

  /** IDOR: cizí run_id nesmí jít uzavřít vlastním skóre. */
  it('do cizího běhu nejde zapsat výsledek', async () => {
    await store.createRun({
      id: 'cizi-beh', userId: 'nekdo-jiny', gameSlug: 'kostkopad',
      mode: 'maraton', seed: 'x', score: 0, durationMs: 0, status: 'pending',
    });

    const response = await app.inject({
      method: 'POST', url: '/api/runs/submit', headers: { cookie },
      payload: { runId: 'cizi-beh', score: 999_999, durationMs: 60_000 },
    });
    expect(response.statusCode).toBe(403);
  });

  it('neexistující běh vrátí 404, ne 500', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/runs/submit', headers: { cookie },
      payload: { runId: 'neexistuje', score: 10, durationMs: 1000 },
    });
    expect(response.statusCode).toBe(404);
  });

  it('uzavřený běh nejde odeslat podruhé', async () => {
    const start = await app.inject({
      method: 'POST', url: '/api/runs/start', headers: { cookie },
      payload: { gameSlug: 'zdvojka', mode: 'klasik' },
    });
    const { runId } = start.json() as { runId: string };

    const first = await app.inject({
      method: 'POST', url: '/api/runs/submit', headers: { cookie },
      payload: { runId, score: 500, durationMs: 60_000 },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST', url: '/api/runs/submit', headers: { cookie },
      payload: { runId, score: 999_999, durationMs: 60_000 },
    });
    expect(second.statusCode).toBe(409);
  });

  it('podvržené skóre bez replaye se u ověřitelné hry neuzná', async () => {
    const start = await app.inject({
      method: 'POST', url: '/api/runs/start', headers: { cookie },
      payload: { gameSlug: 'kostkopad', mode: 'maraton' },
    });
    const { runId } = start.json() as { runId: string };

    const response = await app.inject({
      method: 'POST', url: '/api/runs/submit', headers: { cookie },
      payload: { runId, score: 1_000_000, durationMs: 120_000 },
    });
    expect(response.json()).toMatchObject({ accepted: false });
  });

  it('poctivý běh s replayem projde a dostane pořadí', async () => {
    const start = await app.inject({
      method: 'POST', url: '/api/runs/start', headers: { cookie },
      payload: { gameSlug: 'kostkopad', mode: 'maraton' },
    });
    const { runId, seed } = start.json() as { runId: string; seed: string };

    // Odehrajeme běh přesně tak, jak by ho odehrál klient.
    const game = createKostkopad(seed, { mode: 'maraton' });
    const recorder = createReplayRecorder({
      gameSlug: 'kostkopad', mode: 'maraton', seed,
      rulesVersion: KOSTKOPAD_RULES_VERSION, clientVersion: 'test',
    });
    const pattern = [BIT.left, 0, BIT.a, 0, BIT.right, 0, 0, 0];
    const ticks = 900;
    for (let i = 0; i < ticks; i++) {
      const mask = pattern[i % pattern.length]!;
      recorder.record(mask);
      game.step(mask);
    }

    const response = await app.inject({
      method: 'POST', url: '/api/runs/submit', headers: { cookie },
      payload: {
        runId,
        score: game.state.score,
        durationMs: Math.round((ticks * 1000) / 60),
        replay: Buffer.from(recorder.finish()).toString('base64'),
      },
    });
    expect(response.json()).toMatchObject({ accepted: true });
  });

  it('nekonečno místo skóre neprojde', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/runs/submit', headers: { cookie },
      payload: { runId: 'x', score: Number.POSITIVE_INFINITY, durationMs: 1000 },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('API — denní slovní hra', () => {
  it('odpověď se nevrací, dokud hráč neuhodne nebo nevyčerpá pokusy', async () => {
    const { store, cookie } = storeWithUser();
    await store.setDailyAnswer('petipismenka', new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date()), 'kniha');
    const app = buildServer(store);

    const early = await app.inject({
      method: 'POST', url: '/api/daily/petipismenka/guess', headers: { cookie },
      payload: { guess: 'stolek'.slice(0, 5), attempt: 0 },
    });
    expect(early.statusCode).toBe(200);
    const body = early.json() as { results: string[]; answer?: string };
    expect(body.answer).toBeUndefined();
    expect(body.results).toHaveLength(5);
  });

  it('odpověď dostane hráč až po posledním pokusu', async () => {
    const { store, cookie } = storeWithUser();
    const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
    await store.setDailyAnswer('petipismenka', date, 'kniha');
    const app = buildServer(store);

    const last = await app.inject({
      method: 'POST', url: '/api/daily/petipismenka/guess', headers: { cookie },
      payload: { guess: 'barva', attempt: 5 },
    });
    expect((last.json() as { answer?: string }).answer).toBe('kniha');
  });

  it('pokus mimo povolený rozsah se odmítne', async () => {
    const { store, cookie } = storeWithUser();
    const app = buildServer(store);
    const response = await app.inject({
      method: 'POST', url: '/api/daily/petipismenka/guess', headers: { cookie },
      payload: { guess: 'barva', attempt: 99 },
    });
    expect(response.statusCode).toBe(400);
  });

  it('tip jiné délky se odmítne', async () => {
    const { store, cookie } = storeWithUser();
    const app = buildServer(store);
    const response = await app.inject({
      method: 'POST', url: '/api/daily/petipismenka/guess', headers: { cookie },
      payload: { guess: 'dlouheslovo', attempt: 0 },
    });
    expect(response.statusCode).toBe(400);
  });

  it('veřejný výpis denních výzev neobsahuje odpovědi', async () => {
    const { store } = storeWithUser();
    const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
    await store.setDailyAnswer('petipismenka', date, 'kniha');
    const app = buildServer(store);

    const response = await app.inject({ method: 'GET', url: '/api/daily' });
    expect(response.body).not.toContain('kniha');
  });
});

describe('Tickety pro realtime', () => {
  it('platný ticket projde ověřením', () => {
    const token = issueRealtimeTicket({ userId: 'u1', nickname: 'Hráč', issuedAt: Date.now() });
    expect(verifyRealtimeTicket(token)).toMatchObject({ userId: 'u1', nickname: 'Hráč' });
  });

  it('ticket starší než minutu se zamítne', () => {
    const token = issueRealtimeTicket({
      userId: 'u1', nickname: 'Hráč', issuedAt: Date.now() - 61_000,
    });
    expect(verifyRealtimeTicket(token)).toBeNull();
  });

  it('ticket s podvrženým obsahem se zamítne', () => {
    const token = issueRealtimeTicket({ userId: 'u1', nickname: 'Hráč', issuedAt: Date.now() });
    const [, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({
      userId: 'admin', nickname: 'Admin', issuedAt: Date.now(),
    })).toString('base64url');
    expect(verifyRealtimeTicket(`${forged}.${signature}`)).toBeNull();
  });

  it('ticket bez podpisu se zamítne', () => {
    expect(verifyRealtimeTicket('jenom-neco')).toBeNull();
    expect(verifyRealtimeTicket('')).toBeNull();
  });

  it('podpis se porovnává v konstantním čase a různá délka neprojde', () => {
    expect(verifySignature('data', sign('data', 'tajne'), 'tajne')).toBe(true);
    expect(verifySignature('data', 'kratky', 'tajne')).toBe(false);
    expect(verifySignature('data', sign('data', 'jine'), 'tajne')).toBe(false);
  });
});

describe('Přezdívky', () => {
  it('přijme běžnou přezdívku', () => {
    expect(validateNickname('Rychlý Jezevec')).toMatchObject({ ok: true, value: 'Rychlý Jezevec' });
  });

  it('odmítne příliš krátkou a příliš dlouhou', () => {
    expect(validateNickname('a').ok).toBe(false);
    expect(validateNickname('a'.repeat(19)).ok).toBe(false);
  });

  it('odstraní neviditelné znaky, kterými by šlo rozbít rozhraní', () => {
    const zeroWidth = `Ahoj${String.fromCharCode(0x200b)}${String.fromCharCode(0x202e)}`;
    expect(validateNickname(zeroWidth)).toMatchObject({ ok: true, value: 'Ahoj' });
  });

  it('odmítne značky, kterými by šlo zkusit XSS', () => {
    expect(validateNickname('<script>x</script>').ok).toBe(false);
    expect(validateNickname('"><img onerror=1>').ok).toBe(false);
  });

  it('sjednotí vícenásobné mezery', () => {
    expect(validateNickname('Milý    Ježek')).toMatchObject({ value: 'Milý Ježek' });
  });

  it('filtr vulgarismů se nedá obejít diakritikou ani číslicemi', () => {
    expect(containsProfanity('debil')).toBe(true);
    expect(containsProfanity('d3b1l')).toBe(true);
    expect(containsProfanity('D-E-B-I-L')).toBe(true);
    expect(containsProfanity('ddeebbiill')).toBe(true);
    expect(containsProfanity('Rychlý Jezevec')).toBe(false);
  });

  it('host dostane čitelnou přezdívku ze dvou slov', () => {
    const nickname = guestNickname(createRng('host'));
    expect(nickname.split(' ')).toHaveLength(2);
    expect(validateNickname(nickname).ok).toBe(true);
  });

  it('stejný seed dá hostovi stejnou přezdívku', () => {
    expect(guestNickname(createRng('x'))).toBe(guestNickname(createRng('x')));
  });
});

describe('API — obecné', () => {
  it('neznámý endpoint vrací 404 v JSON', async () => {
    const app = buildServer(createMemoryStore());
    const response = await app.inject({ method: 'GET', url: '/api/neexistuje' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toHaveProperty('error');
  });

  it('health endpoint odpovídá', async () => {
    const app = buildServer(createMemoryStore());
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('žebříček neposílá ven identifikátory hráčů', async () => {
    const store = createMemoryStore();
    await store.recordLeaderboardEntry('had', 'klasik', 'tajne-id', 'Hráč', 100, 'high');
    const app = buildServer(store);
    const response = await app.inject({ method: 'GET', url: '/api/leaderboards/had?mode=klasik' });
    expect(response.body).not.toContain('tajne-id');
    expect(response.body).toContain('Hráč');
  });
});
