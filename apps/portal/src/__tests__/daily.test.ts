import { describe, it, expect, beforeEach } from 'vitest';
import { pragueToday, dayNumber, challengesFor, completeChallenge, currentStreak, bestStreak, progressToday } from '../lib/daily.js';

/** Minimální localStorage pro testy v Node. */
function installStorage(): void {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

beforeEach(() => installStorage());

describe('pragueToday a dayNumber', () => {
  it('vrací datum ve formátu RRRR-MM-DD', () => {
    expect(pragueToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('počítá v pražském čase, ne v UTC', () => {
    // 23:30 UTC je v Praze už další den (zimní čas).
    expect(pragueToday(new Date('2026-03-10T23:30:00Z'))).toBe('2026-03-11');
  });

  it('číslo dne roste po jedné', () => {
    expect(dayNumber('2026-01-02') - dayNumber('2026-01-01')).toBe(1);
  });

  it('číslo dne je pro dané datum stabilní', () => {
    expect(dayNumber('2026-05-05')).toBe(dayNumber('2026-05-05'));
  });
});

describe('challengesFor', () => {
  it('vybere nejvýš tři hry', () => {
    expect(challengesFor('2026-04-01').length).toBeLessThanOrEqual(3);
  });

  it('žádnou hru nevybere dvakrát', () => {
    for (const date of ['2026-04-01', '2026-04-02', '2026-07-15', '2026-12-31']) {
      const slugs = challengesFor(date).map((c) => c.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('pro stejný den dá stejný výběr', () => {
    expect(challengesFor('2026-06-06').map((c) => c.slug))
      .toEqual(challengesFor('2026-06-06').map((c) => c.slug));
  });

  it('výběr se mezi dny mění', () => {
    const a = challengesFor('2026-06-06').map((c) => c.slug).join(',');
    const b = challengesFor('2026-06-09').map((c) => c.slug).join(',');
    // Při malém katalogu se výběry můžou krýt, ale ne napořád.
    const dates = ['2026-06-06', '2026-06-07', '2026-06-08', '2026-06-09', '2026-06-10'];
    const variants = new Set(dates.map((d) => challengesFor(d).map((c) => c.slug).join(',')));
    expect(variants.size).toBeGreaterThan(1);
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });

  it('každá vybraná hra má denní seed odvozený z data', () => {
    for (const challenge of challengesFor('2026-02-02')) {
      expect(challenge.seed).toBe(`daily:${challenge.slug}:2026-02-02`);
    }
  });
});

describe('série dní', () => {
  it('první dokončená výzva založí sérii', () => {
    const slug = challengesFor('2026-03-01')[0]!.slug;
    completeChallenge(slug, 100, '2026-03-01');
    expect(currentStreak('2026-03-01')).toBe(1);
  });

  it('hraní další den sérii prodlouží', () => {
    completeChallenge(challengesFor('2026-03-01')[0]!.slug, 100, '2026-03-01');
    completeChallenge(challengesFor('2026-03-02')[0]!.slug, 100, '2026-03-02');
    expect(currentStreak('2026-03-02')).toBe(2);
  });

  it('vynechaný den sérii přetrhne', () => {
    completeChallenge(challengesFor('2026-03-01')[0]!.slug, 100, '2026-03-01');
    completeChallenge(challengesFor('2026-03-05')[0]!.slug, 100, '2026-03-05');
    expect(currentStreak('2026-03-05')).toBe(1);
  });

  it('druhá výzva téhož dne sérii neprodlouží', () => {
    const challenges = challengesFor('2026-03-01');
    completeChallenge(challenges[0]!.slug, 100, '2026-03-01');
    completeChallenge(challenges[1]!.slug, 100, '2026-03-01');
    expect(currentStreak('2026-03-01')).toBe(1);
  });

  it('série drží i den po posledním hraní', () => {
    completeChallenge(challengesFor('2026-03-01')[0]!.slug, 100, '2026-03-01');
    // Dnes je 2. března a hráč ještě nehrál — série se ještě nepřetrhla.
    expect(currentStreak('2026-03-02')).toBe(1);
    // O den později už ano.
    expect(currentStreak('2026-03-03')).toBe(0);
  });

  it('nejdelší série se pamatuje i po přetržení', () => {
    completeChallenge(challengesFor('2026-03-01')[0]!.slug, 100, '2026-03-01');
    completeChallenge(challengesFor('2026-03-02')[0]!.slug, 100, '2026-03-02');
    completeChallenge(challengesFor('2026-03-03')[0]!.slug, 100, '2026-03-03');
    completeChallenge(challengesFor('2026-03-20')[0]!.slug, 100, '2026-03-20');
    expect(currentStreak('2026-03-20')).toBe(1);
    expect(bestStreak()).toBe(3);
  });

  it('lepší výsledek přepíše horší, horší ne lepší', () => {
    const slug = challengesFor('2026-03-01')[0]!.slug;
    completeChallenge(slug, 100, '2026-03-01');
    completeChallenge(slug, 50, '2026-03-01');
    expect(challengesFor('2026-03-01').find((c) => c.slug === slug)?.score).toBe(100);
    completeChallenge(slug, 300, '2026-03-01');
    expect(challengesFor('2026-03-01').find((c) => c.slug === slug)?.score).toBe(300);
  });

  it('nový den vynuluje seznam hotových', () => {
    completeChallenge(challengesFor('2026-03-01')[0]!.slug, 100, '2026-03-01');
    expect(progressToday('2026-03-01').done).toBe(1);
    expect(progressToday('2026-03-02').done).toBe(0);
  });
});
