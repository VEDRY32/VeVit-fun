/**
 * Plánovač úloh.
 *
 * Vlastní, protože potřebujeme jediné: „spusť tohle v danou hodinu podle
 * času v Praze". Knihovna pro cron by přinesla vlastní parsování výrazů
 * a časových zón, které tu nikdo nepoužije.
 */

export interface Job {
  name: string;
  /** Hodina a minuta v Europe/Prague. */
  at: { hour: number; minute: number };
  run(): Promise<void>;
}

const TIMEZONE = 'Europe/Prague';

/** Aktuální hodina a minuta v Praze — nezávisle na časové zóně serveru. */
export function pragueTime(now = new Date()): { hour: number; minute: number; date: string } {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    hour: '2-digit', minute: '2-digit',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);

  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    date: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

export interface Scheduler {
  start(): void;
  stop(): void;
  /** Spustí úlohu hned — pro ruční zásah a testy. */
  runNow(name: string): Promise<void>;
}

export function createScheduler(jobs: Job[], logger = console): Scheduler {
  let timer: ReturnType<typeof setInterval> | null = null;
  // Bez tohohle by se úloha na přelomu minuty spustila několikrát za sebou.
  const lastRun = new Map<string, string>();

  const tick = async (): Promise<void> => {
    const { hour, minute, date } = pragueTime();
    for (const job of jobs) {
      if (job.at.hour !== hour || job.at.minute !== minute) continue;
      const key = `${date} ${hour}:${minute}`;
      if (lastRun.get(job.name) === key) continue;
      lastRun.set(job.name, key);

      try {
        logger.log(`[worker] spouštím ${job.name}`);
        await job.run();
        logger.log(`[worker] hotovo ${job.name}`);
      } catch (error) {
        // Jedna spadlá úloha nesmí shodit plánovač ani ostatní úlohy.
        logger.error(`[worker] ${job.name} selhalo:`, error);
      }
    }
  };

  return {
    start() {
      if (timer) return;
      void tick();
      timer = setInterval(() => void tick(), 30_000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    async runNow(name) {
      const job = jobs.find((j) => j.name === name);
      if (!job) throw new Error(`Úloha ${name} neexistuje.`);
      await job.run();
    },
  };
}
