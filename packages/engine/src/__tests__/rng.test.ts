import { describe, it, expect } from 'vitest';
import { createRng, hashSeed, dailySeed } from '../rng.js';

describe('createRng', () => {
  it('dá stejnou posloupnost pro stejný seed', () => {
    const a = createRng('kostkopad:2026-09-11');
    const b = createRng('kostkopad:2026-09-11');
    const seqA = Array.from({ length: 50 }, () => a.u32());
    const seqB = Array.from({ length: 50 }, () => b.u32());
    expect(seqA).toEqual(seqB);
  });

  it('dá různou posloupnost pro různý seed', () => {
    const a = createRng('a');
    const b = createRng('b');
    expect(a.u32()).not.toBe(b.u32());
  });

  it('drží next() v <0, 1)', () => {
    const rng = createRng('rozsah');
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('drží int(min, max) v polootevřeném intervalu', () => {
    const rng = createRng('int');
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) seen.add(rng.int(3, 7));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('umí obnovit stav a pokračovat stejně', () => {
    const rng = createRng('stav');
    for (let i = 0; i < 17; i++) rng.u32();
    const state = rng.getState();
    const expected = Array.from({ length: 10 }, () => rng.u32());

    rng.setState(state);
    const actual = Array.from({ length: 10 }, () => rng.u32());
    expect(actual).toEqual(expected);
  });

  it('shuffle nemění vstup a zachová prvky', () => {
    const rng = createRng('shuffle');
    const input = [1, 2, 3, 4, 5, 6, 7];
    const out = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect([...out].sort((x, y) => x - y)).toEqual(input);
  });

  it('shuffle je pro stejný seed deterministický', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    expect(createRng('s').shuffle(items)).toEqual(createRng('s').shuffle(items));
  });

  it('fork dá nezávislý, ale reprodukovatelný generátor', () => {
    const base = createRng('base');
    const forkA = base.fork('castice');
    const base2 = createRng('base');
    const forkB = base2.fork('castice');
    expect(forkA.u32()).toBe(forkB.u32());
  });

  it('chance drží zhruba zadanou pravděpodobnost', () => {
    const rng = createRng('chance');
    let hits = 0;
    for (let i = 0; i < 20_000; i++) if (rng.chance(0.25)) hits++;
    expect(hits / 20_000).toBeGreaterThan(0.23);
    expect(hits / 20_000).toBeLessThan(0.27);
  });

  it('hashSeed vrací čtyři 32bitová slova', () => {
    const state = hashSeed('test');
    expect(state).toHaveLength(4);
    for (const word of state) {
      expect(Number.isInteger(word)).toBe(true);
      expect(word).toBeGreaterThanOrEqual(0);
      expect(word).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('dailySeed je stabilní pro hru a datum', () => {
    expect(dailySeed('petipismenka', '2026-09-11')).toBe('daily:petipismenka:2026-09-11');
  });
});
