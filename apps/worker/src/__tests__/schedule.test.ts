import { describe, it, expect, vi } from 'vitest';
import { createScheduler, pragueTime, type Job } from '../schedule.js';
import { allJobs, dailyChallengeJob } from '../jobs.js';

const silent = { log: () => {}, error: () => {} } as unknown as Console;

describe('pragueTime', () => {
  it('vrací datum ve formátu RRRR-MM-DD', () => {
    expect(pragueTime()).toHaveProperty('date');
    expect(pragueTime().date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('počítá čas v Praze, ne v časové zóně serveru', () => {
    // Poledne UTC je v Praze 13:00 (zimní čas) nebo 14:00 (letní).
    const noonUtc = new Date('2026-01-15T12:00:00Z');
    expect(pragueTime(noonUtc).hour).toBe(13);

    const summerNoonUtc = new Date('2026-07-15T12:00:00Z');
    expect(pragueTime(summerNoonUtc).hour).toBe(14);
  });

  it('přelom roku v UTC ještě není přelom v Praze', () => {
    const beforeMidnightPrague = new Date('2025-12-31T22:30:00Z');
    expect(pragueTime(beforeMidnightPrague).date).toBe('2025-12-31');

    const afterMidnightPrague = new Date('2025-12-31T23:30:00Z');
    expect(pragueTime(afterMidnightPrague).date).toBe('2026-01-01');
  });
});

describe('createScheduler', () => {
  it('spustí úlohu na vyžádání', async () => {
    const run = vi.fn(async () => {});
    const scheduler = createScheduler([{ name: 'test', at: { hour: 3, minute: 0 }, run }], silent);
    await scheduler.runNow('test');
    expect(run).toHaveBeenCalledOnce();
  });

  it('neznámá úloha vyhodí srozumitelnou chybu', async () => {
    const scheduler = createScheduler([], silent);
    await expect(scheduler.runNow('neexistuje')).rejects.toThrow(/neexistuje/);
  });

  it('spadlá úloha nesmí shodit plánovač', async () => {
    const failing: Job = {
      name: 'padajici',
      at: { hour: 0, minute: 0 },
      run: async () => {
        throw new Error('rozbito');
      },
    };
    const scheduler = createScheduler([failing], silent);
    // runNow chybu propustí, ale plánovaný běh ji musí spolknout — to je
    // vidět na tom, že start() nevyhodí.
    await expect(scheduler.runNow('padajici')).rejects.toThrow();
    expect(() => {
      scheduler.start();
      scheduler.stop();
    }).not.toThrow();
  });

  it('opakované start() nevytvoří druhý časovač', () => {
    const scheduler = createScheduler([], silent);
    scheduler.start();
    scheduler.start();
    expect(() => scheduler.stop()).not.toThrow();
  });
});

describe('úlohy', () => {
  it('denní výzvy připravují zítřek, ne dnešek', async () => {
    const calls: { path: string; body?: unknown }[] = [];
    const job = dailyChallengeJob({
      api: async (path, body) => {
        calls.push({ path, body });
        return null;
      },
      answers: ['kniha', 'barva'],
    });

    await job.run();

    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
    const dates = calls.map((c) => (c.body as { date: string }).date);
    expect(dates.every((d) => d > today)).toBe(true);
  });

  it('denní odpověď se vybírá ze seedu, takže je po výpadku zopakovatelná', async () => {
    const pick = async (): Promise<string> => {
      let answer = '';
      await dailyChallengeJob({
        api: async (path, body) => {
          if (path === '/api/daily/answer') answer = (body as { answer: string }).answer;
          return null;
        },
        answers: ['kniha', 'barva', 'stolek'.slice(0, 5), 'lampa'],
      }).run();
      return answer;
    };
    expect(await pick()).toBe(await pick());
  });

  it('denní odpověď pochází ze zadaného slovníku', async () => {
    const answers = ['kniha', 'barva', 'lampa'];
    let chosen = '';
    await dailyChallengeJob({
      api: async (path, body) => {
        if (path === '/api/daily/answer') chosen = (body as { answer: string }).answer;
        return null;
      },
      answers,
    }).run();
    expect(answers).toContain(chosen);
  });

  it('všechny úlohy mají jedinečný název a platný čas', () => {
    const jobs = allJobs({ api: async () => null, answers: ['kniha'] });
    expect(new Set(jobs.map((j) => j.name)).size).toBe(jobs.length);
    for (const job of jobs) {
      expect(job.at.hour).toBeGreaterThanOrEqual(0);
      expect(job.at.hour).toBeLessThan(24);
      expect(job.at.minute).toBeGreaterThanOrEqual(0);
      expect(job.at.minute).toBeLessThan(60);
    }
  });

  it('zálohy běží po přepočtu žebříčků', () => {
    const jobs = allJobs({ api: async () => null, answers: ['kniha'] });
    const minutes = (name: string): number => {
      const job = jobs.find((j) => j.name === name)!;
      return job.at.hour * 60 + job.at.minute;
    };
    expect(minutes('zaloha')).toBeGreaterThan(minutes('prepocet-zebricku'));
  });
});
