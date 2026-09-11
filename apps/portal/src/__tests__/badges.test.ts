import { describe, it, expect, beforeEach } from 'vitest';
import { BADGES, evaluateBadges, badgeStates, unlockedCount, EMPTY_STATS } from '../lib/badges.js';

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

describe('definice odznaků', () => {
  it('každý má jedinečné id', () => {
    const ids = BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('herní odznaky odkazují na hru', () => {
    for (const badge of BADGES.filter((b) => b.scope === 'game')) {
      expect(badge.game).toBeTruthy();
    }
  });

  it('každý má český název i popis', () => {
    for (const badge of BADGES) {
      expect(badge.title.length).toBeGreaterThan(2);
      expect(badge.description.length).toBeGreaterThan(5);
    }
  });
});

describe('evaluateBadges', () => {
  it('prázdné statistiky odemknou nanejvýš skryté odznaky na čase', () => {
    const earned = evaluateBadges(EMPTY_STATS);
    expect(earned.every((b) => b.hidden === true)).toBe(true);
  });

  it('první partie odemkne odznak', () => {
    const earned = evaluateBadges({ ...EMPTY_STATS, plays: { had: 1 } });
    expect(earned.map((b) => b.id)).toContain('prvni-hra');
  });

  it('stejný odznak se neodemkne dvakrát', () => {
    evaluateBadges({ ...EMPTY_STATS, plays: { had: 1 } });
    const second = evaluateBadges({ ...EMPTY_STATS, plays: { had: 2 } });
    expect(second.map((b) => b.id)).not.toContain('prvni-hra');
  });

  it('pět různých her odemkne odznak za rozhled', () => {
    const earned = evaluateBadges({
      ...EMPTY_STATS,
      plays: { had: 1, zdvojka: 1, pexeso: 1, mavnik: 1, invaze: 1 },
    });
    expect(earned.map((b) => b.id)).toContain('pet-her');
  });

  it('pětkrát táž hra rozhled neodemkne', () => {
    const earned = evaluateBadges({ ...EMPTY_STATS, plays: { had: 5 } });
    expect(earned.map((b) => b.id)).not.toContain('pet-her');
  });

  it('série odemyká postupně', () => {
    const three = evaluateBadges({ ...EMPTY_STATS, streak: 3 }).map((b) => b.id);
    expect(three).toContain('serie-3');
    expect(three).not.toContain('serie-7');

    const seven = evaluateBadges({ ...EMPTY_STATS, streak: 7 }).map((b) => b.id);
    expect(seven).toContain('serie-7');
  });

  it('herní odznak se váže na skóre dané hry', () => {
    const earned = evaluateBadges({ ...EMPTY_STATS, best: { kostkopad: 1200 } });
    expect(earned.map((b) => b.id)).toContain('kostkopad-1000');
    expect(earned.map((b) => b.id)).not.toContain('kostkopad-10000');
  });

  it('získané odznaky se počítají a drží stav', () => {
    evaluateBadges({ ...EMPTY_STATS, plays: { had: 1 } });
    expect(unlockedCount()).toBeGreaterThan(0);
    const states = badgeStates();
    expect(states.find((b) => b.id === 'prvni-hra')?.unlocked).toBe(true);
    expect(states.find((b) => b.id === 'stovka')?.unlocked).toBe(false);
  });

  it('badgeStates vrací všechny odznaky, i nezískané', () => {
    expect(badgeStates()).toHaveLength(BADGES.length);
  });
});
