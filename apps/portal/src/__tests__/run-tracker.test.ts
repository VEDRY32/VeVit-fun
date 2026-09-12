import { describe, it, expect } from 'vitest';
import { createRunTracker } from '../lib/run-tracker.js';

describe('createRunTracker', () => {
  it('čerstvý běh je aktuální', () => {
    const tracker = createRunTracker();
    expect(tracker.begin().current).toBe(true);
  });

  it('novější běh zneplatní starší', () => {
    const tracker = createRunTracker();
    const prvni = tracker.begin();
    const druhy = tracker.begin();
    expect(prvni.current).toBe(false);
    expect(druhy.current).toBe(true);
  });

  it('cancel() zneplatní i ten poslední běh', () => {
    const tracker = createRunTracker();
    const beh = tracker.begin();
    tracker.cancel();
    expect(beh.current).toBe(false);
  });
});

/**
 * Simulace startovní sekvence portálu.
 *
 * `GamePage.startGame` má mezi úklidem staré hry a `mount()` dvě `await`
 * místa (načtení modulu, vyžádání běhu ze serveru). Když se spustí dvakrát
 * přes sebe — ve `StrictMode` se to v dev režimu děje při každém načtení
 * stránky — doběhnou bez hlídače obě volání až za `await` a obě zavolají
 * `mount()`. Druhou instanci si portál zapamatuje, první osiří: její smyčka
 * běží dál a její `gameover` pak ukončí živou partii hráče.
 */
interface FakeInstance {
  readonly label: string;
  readonly alive: boolean;
  destroy(): void;
  /** Hra se sama dohraje a ohlásí konec — tak jako had, který narazí do zdi. */
  finishOnItsOwn(): void;
}

/**
 * @param guarded `false` = stav před opravou, kdy se tokenu nikdo neptal.
 */
function makeHarness(guarded: boolean) {
  const tracker = createRunTracker();
  const mounted: FakeInstance[] = [];
  const events: string[] = [];
  let live: FakeInstance | null = null;

  const start = async (label: string): Promise<void> => {
    const run = tracker.begin();
    const stale = (): boolean => guarded && !run.current;

    live?.destroy();
    live = null;

    await Promise.resolve(); // await #1 — načtení herního modulu
    if (stale()) return;
    await Promise.resolve(); // await #2 — vyžádání běhu a seedu ze serveru
    if (stale()) return;

    let alive = true;
    const instance: FakeInstance = {
      label,
      get alive() {
        return alive;
      },
      destroy() {
        alive = false;
      },
      finishOnItsOwn() {
        if (!alive) return; // uklizená hra už smyčku nemá
        if (stale()) return; // události z nahrazeného běhu do portálu nepatří
        events.push(`gameover:${label}`);
      },
    };
    mounted.push(instance);

    if (stale()) {
      instance.destroy();
      return;
    }
    live = instance;
  };

  return { start, mounted, events, tracker };
}

/** StrictMode: setup → cleanup → setup, obojí dřív, než doběhne `await`. */
async function doubleStart(h: ReturnType<typeof makeHarness>): Promise<void> {
  const first = h.start('had#1');
  h.tracker.cancel();
  const second = h.start('had#2');
  await Promise.all([first, second]);
}

describe('startovní sekvence portálu', () => {
  it('bez hlídače zůstane po překrytém spuštění běžet druhá hra', async () => {
    const h = makeHarness(false);
    await doubleStart(h);

    // Tohle je ta chyba: namountovaly se dvě hry.
    expect(h.mounted.map((i) => i.label)).toEqual(['had#1', 'had#2']);

    for (const instance of h.mounted) instance.finishOnItsOwn();

    // A osiřelá hra ukončí partii, kterou hráč právě hraje.
    expect(h.events).toContain('gameover:had#1');
  });

  it('s hlídačem se překrytý běh vůbec nenamountuje', async () => {
    const h = makeHarness(true);
    await doubleStart(h);

    expect(h.mounted.map((i) => i.label)).toEqual(['had#2']);
  });

  it('s hlídačem neukončí osiřelá hra živou partii hráče', async () => {
    const h = makeHarness(true);
    await doubleStart(h);

    for (const instance of h.mounted) instance.finishOnItsOwn();

    // Ohlásit smí jen ta hra, kterou hráč doopravdy hraje.
    expect(h.events).toEqual(['gameover:had#2']);
  });

  it('konec normálně spuštěné hry se pořád hlásí', async () => {
    const h = makeHarness(true);
    await h.start('had');

    for (const instance of h.mounted) instance.finishOnItsOwn();

    expect(h.events).toEqual(['gameover:had']);
  });
});
