/** Zjednodušování a interpolace — pro UI animace uvnitř her. */

export type Easing = (t: number) => number;

export const easing = {
  linear: (t: number): number => t,
  inQuad: (t: number): number => t * t,
  outQuad: (t: number): number => t * (2 - t),
  inOutQuad: (t: number): number => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t: number): number => 1 - (1 - t) ** 3,
  inOutCubic: (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t: number): number => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  outElastic: (t: number): number =>
    t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1,
  outBounce: (t: number): number => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
} satisfies Record<string, Easing>;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number): number => clamp(v, 0, 1);

/** Framerate-nezávislé doplňování k cíli. */
export const approach = (current: number, target: number, maxStep: number): number => {
  const diff = target - current;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
};

export interface Tween {
  /** Posune o jeden krok logiky; vrací `true`, dokud běží. */
  update(): boolean;
  readonly value: number;
  readonly done: boolean;
}

/** `durationTicks` je v krocích logiky (60 = jedna sekunda). */
export function createTween(from: number, to: number, durationTicks: number, ease: Easing = easing.outCubic): Tween {
  let elapsed = 0;
  let value = from;
  return {
    update() {
      if (elapsed >= durationTicks) return false;
      elapsed++;
      value = lerp(from, to, ease(clamp01(elapsed / durationTicks)));
      return elapsed < durationTicks;
    },
    get value() {
      return value;
    },
    get done() {
      return elapsed >= durationTicks;
    },
  };
}
