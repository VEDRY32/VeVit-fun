/**
 * Denní výzvy.
 *
 * U slovních her vyhodnocuje tipy **server** — odpověď se nikdy nedostane
 * ke klientovi, ani nepřímo (zadání 3.3, 7.2).
 */

import type { FastifyInstance } from 'fastify';
import { evaluateGuess, MAX_GUESSES, WORD_LENGTH } from '@vevit-games/rules';
import { createRng } from '@vevit-games/engine/core';
import type { Store } from '../db/store.js';
import { config } from '../config.js';

/** Dnešní datum v Praze; denní výzvy se mění o půlnoci místního času. */
export function pragueDate(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: config.timezone }).format(now);
}

interface GuessBody {
  guess?: string;
  attempt?: number;
}

export function registerDailyRoutes(app: FastifyInstance, store: Store): void {
  app.get('/api/daily', async () => {
    const date = pragueDate();
    // Seedy denních výzev jsou veřejné; odpovědi nikdy.
    return {
      date,
      games: ['kostkopad', 'petipismenka', 'zdvojka'].map((slug) => ({
        slug,
        seed: `daily:${slug}:${date}`,
      })),
    };
  });

  app.post('/api/daily/petipismenka/guess', async (request, reply) => {
    const body = (request.body ?? {}) as GuessBody;
    const guess = (body.guess ?? '').trim().toLowerCase();

    if ([...guess].length !== WORD_LENGTH) {
      return reply.code(400).send({ error: `Tip musí mít ${WORD_LENGTH} znaků.` });
    }
    // Bez stropu by šlo posílat tipy donekonečna a odpověď uhádnout hrubou silou.
    if (typeof body.attempt !== 'number' || body.attempt < 0 || body.attempt >= MAX_GUESSES) {
      return reply.code(400).send({ error: 'Neplatné pořadí pokusu.' });
    }

    const date = pragueDate();
    const answer = await store.dailyAnswer('petipismenka', date);
    if (!answer) {
      return reply.code(503).send({ error: 'Dnešní slovo ještě není připravené.' });
    }

    const results = evaluateGuess(guess, answer);
    const won = results.every((r) => r === 'correct');

    // Odpověď se vrací jen po vyčerpání všech pokusů — jinak by ji šlo
    // přečíst z odpovědi API hned v prvním kole.
    const exhausted = body.attempt + 1 >= MAX_GUESSES;
    return reply.send({
      results,
      won,
      answer: won || exhausted ? answer : undefined,
    });
  });

  /** Vygeneruje dnešní odpověď, pokud ještě neexistuje. Volá worker. */
  app.post('/api/daily/prepare', async (request, reply) => {
    const words = (request.body as { words?: string[] })?.words ?? [];
    if (words.length === 0) return reply.code(400).send({ error: 'Chybí slovník.' });

    const date = pragueDate();
    if (await store.dailyAnswer('petipismenka', date)) {
      return reply.send({ prepared: false, reason: 'Dnešní slovo už existuje.' });
    }

    const rng = createRng(`daily:petipismenka:${date}`);
    await store.setDailyAnswer('petipismenka', date, rng.pick(words));
    return reply.send({ prepared: true, date });
  });
}
