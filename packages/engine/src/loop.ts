/**
 * Herní smyčka s fixním krokem logiky.
 *
 * Logika běží vždy na 60 Hz bez ohledu na obnovovací frekvenci displeje —
 * jinak by se hra na 144Hz monitoru chovala jinak než na 60Hz a replay by
 * se rozešel. Render dostává `alpha` pro interpolaci mezi dvěma kroky.
 */

export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/** Nad tuto hranici se nahromaděný čas zahodí (přepnutá záložka, breakpoint). */
const MAX_FRAME_MS = 250;

export interface LoopCallbacks {
  /** Jeden krok logiky. `tick` je pořadové číslo od startu. */
  update(tick: number): void;
  /** Vykreslení. `alpha` je 0..1 pozice mezi předchozím a aktuálním krokem. */
  render(alpha: number): void;
}

export interface LoopStats {
  fps: number;
  tick: number;
  /** Průměrná doba jednoho kroku logiky v ms — pro profilaci. */
  updateMs: number;
}

export interface GameLoop {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  readonly running: boolean;
  readonly paused: boolean;
  readonly stats: LoopStats;
  /** Jeden krok vpřed při pauze — pro trénink a ladění. */
  step(): void;
}

export interface LoopOptions {
  /** Automaticky pauzovat při ztrátě fokusu nebo skrytí tabu. Výchozí `true`. */
  autoPause?: boolean;
  /** Voláno, když smyčka sama pauzne — portál na to ukáže PauseOverlay. */
  onAutoPause?: () => void;
}

export function createLoop(cb: LoopCallbacks, options: LoopOptions = {}): GameLoop {
  const { autoPause = true, onAutoPause } = options;

  let running = false;
  let paused = false;
  let rafId = 0;
  let lastTime = 0;
  let accumulator = 0;
  let tick = 0;

  // Klouzavý průměr přes 30 snímků — stabilnější číslo než okamžitá hodnota.
  let fps = 60;
  let updateMs = 0;

  const stats: LoopStats = {
    get fps() {
      return Math.round(fps);
    },
    get tick() {
      return tick;
    },
    get updateMs() {
      return Math.round(updateMs * 100) / 100;
    },
  } as LoopStats;

  const frame = (now: number): void => {
    if (!running) return;
    rafId = requestAnimationFrame(frame);

    let delta = now - lastTime;
    lastTime = now;
    if (delta > MAX_FRAME_MS) delta = TICK_MS; // po dlouhé pauze nedoháníme
    if (delta > 0) fps += (1000 / delta - fps) * 0.05;

    if (!paused) {
      accumulator += delta;
      const t0 = performance.now();
      let steps = 0;
      while (accumulator >= TICK_MS) {
        cb.update(tick++);
        accumulator -= TICK_MS;
        // Pojistka proti spirále smrti: raději zpomalíme hru, než abychom
        // zamrzli ve while cyklu.
        if (++steps >= 5) {
          accumulator = 0;
          break;
        }
      }
      if (steps > 0) updateMs += ((performance.now() - t0) / steps - updateMs) * 0.1;
    }

    cb.render(paused ? 1 : accumulator / TICK_MS);
  };

  const handleVisibility = (): void => {
    if (document.hidden && running && !paused) {
      paused = true;
      onAutoPause?.();
    }
  };
  const handleBlur = (): void => {
    if (running && !paused) {
      paused = true;
      onAutoPause?.();
    }
  };

  return {
    start() {
      if (running) return;
      running = true;
      paused = false;
      lastTime = performance.now();
      accumulator = 0;
      if (autoPause) {
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('blur', handleBlur);
      }
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    },
    pause() {
      paused = true;
    },
    resume() {
      if (!paused) return;
      paused = false;
      // Bez tohohle by se po pauze naráz odbavilo všechno nahromaděné.
      lastTime = performance.now();
      accumulator = 0;
    },
    step() {
      if (!paused) return;
      cb.update(tick++);
      cb.render(1);
    },
    get running() {
      return running;
    },
    get paused() {
      return paused;
    },
    stats,
  };
}
