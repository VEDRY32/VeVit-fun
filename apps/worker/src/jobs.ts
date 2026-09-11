/** Konkrétní úlohy workeru. */

import { createRng, dailySeed } from '@vevit-games/engine/core';
import type { Job } from './schedule.js';

export interface WorkerDeps {
  /** Volání API se service oprávněním. */
  api(path: string, body?: unknown): Promise<unknown>;
  /** Slovník odpovědí pro denní slovní hru. */
  answers: readonly string[];
  logger?: Pick<Console, 'log' | 'error'>;
}

/**
 * Denní výzvy na zítřek.
 *
 * Běží těsně po půlnoci, ale připravuje **zítřejší** den — kdyby úloha
 * spadla, je den na opravu, ne minuta.
 */
export function dailyChallengeJob(deps: WorkerDeps): Job {
  return {
    name: 'denni-vyzvy',
    at: { hour: 0, minute: 5 },
    async run() {
      const tomorrow = new Date(Date.now() + 86_400_000);
      const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(tomorrow);

      for (const slug of ['kostkopad', 'zdvojka', 'petipismenka']) {
        await deps.api('/api/daily/challenge', { date, gameSlug: slug, seed: dailySeed(slug, date) });
      }

      // Odpověď slovní hry se volí ze seedu, aby šla po výpadku zopakovat.
      const rng = createRng(dailySeed('petipismenka', date));
      await deps.api('/api/daily/answer', {
        date,
        gameSlug: 'petipismenka',
        answer: rng.pick(deps.answers),
      });
    },
  };
}

/** Přepočet žebříčků — materializovaný pohled se neobnoví sám. */
export function leaderboardJob(deps: WorkerDeps): Job {
  return {
    name: 'prepocet-zebricku',
    at: { hour: 3, minute: 0 },
    async run() {
      await deps.api('/api/admin/leaderboards/rebuild');
    },
  };
}

/** Záloha databáze. Podrobnosti v ops/RUNBOOK.md §7. */
export function backupJob(deps: WorkerDeps): Job {
  return {
    name: 'zaloha',
    at: { hour: 3, minute: 15 },
    async run() {
      await deps.api('/api/admin/backup');
    },
  };
}

/** Úklid: prošlá sezení a hodnocené běhy, které nikdo nedohrál. */
export function cleanupJob(deps: WorkerDeps): Job {
  return {
    name: 'uklid',
    at: { hour: 4, minute: 0 },
    async run() {
      await deps.api('/api/admin/cleanup');
    },
  };
}

export function allJobs(deps: WorkerDeps): Job[] {
  return [
    dailyChallengeJob(deps),
    leaderboardJob(deps),
    backupJob(deps),
    cleanupJob(deps),
  ];
}
