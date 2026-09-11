import { describe, it, expect } from 'vitest';
import { createReplayRecorder, parseReplay, type ReplayMeta } from '../replay.js';

const META: ReplayMeta = {
  gameSlug: 'kostkopad',
  mode: 'sprint40',
  seed: 'daily:kostkopad:2026-09-11',
  rulesVersion: 1,
  clientVersion: '0.1.0',
};

describe('replay', () => {
  it('přežije kolečko zápis → čtení beze ztráty', () => {
    const recorder = createReplayRecorder(META);
    const masks = [0, 0, 0, 1, 1, 5, 5, 5, 5, 0, 12];
    for (const m of masks) recorder.record(m);

    const parsed = parseReplay(recorder.finish());
    expect(parsed.meta).toEqual(META);
    expect([...parsed.masks]).toEqual(masks);
  });

  it('běhová délka opravdu komprimuje dlouhé nečinné úseky', () => {
    const recorder = createReplayRecorder(META);
    for (let i = 0; i < 6000; i++) recorder.record(0);
    const bytes = recorder.finish();
    // 6000 kroků nesmí stát 6000 bajtů — jde o jeden úsek.
    expect(bytes.length).toBeLessThan(100);
    expect(parseReplay(bytes).masks).toHaveLength(6000);
  });

  it('respektuje strop délky', () => {
    const recorder = createReplayRecorder(META, 10);
    for (let i = 0; i < 50; i++) recorder.record(i % 3);
    expect(recorder.ticks).toBe(10);
  });

  it('odmítne cizí data', () => {
    expect(() => parseReplay(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(/replay VeVit Games/);
  });

  it('odmítne neznámou verzi', () => {
    const bytes = createReplayRecorder(META).finish();
    bytes[2] = 99;
    expect(() => parseReplay(bytes)).toThrow(/verze replaye/);
  });

  it('odmítne useknutý replay', () => {
    const recorder = createReplayRecorder(META);
    for (let i = 0; i < 100; i++) recorder.record(3);
    const bytes = recorder.finish();
    expect(() => parseReplay(bytes.subarray(0, bytes.length - 3))).toThrow();
  });

  it('odmítne replay delší než povolený strop', () => {
    const recorder = createReplayRecorder(META);
    for (let i = 0; i < 500; i++) recorder.record(1);
    expect(() => parseReplay(recorder.finish(), 100)).toThrow(/nepřiměřeně dlouhý/);
  });

  it('zvládne prázdný záznam', () => {
    const parsed = parseReplay(createReplayRecorder(META).finish());
    expect(parsed.masks).toHaveLength(0);
  });
});
