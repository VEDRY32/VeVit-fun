/**
 * Syntéza zvukových efektů — vlastní TypeScript implementace algoritmu ZzFX
 * (Frank Force, MIT). Negeneruje soubory: každý zvuk je pár čísel, která se
 * v běhu přepočítají na vzorky. Celá zvuková stránka portálu tak váží nula bajtů.
 */

export type ZzfxParams = [
  volume?: number,
  randomness?: number,
  frequency?: number,
  attack?: number,
  sustain?: number,
  release?: number,
  shape?: number,
  shapeCurve?: number,
  slide?: number,
  deltaSlide?: number,
  pitchJump?: number,
  pitchJumpTime?: number,
  repeatTime?: number,
  noise?: number,
  modulation?: number,
  bitCrush?: number,
  delay?: number,
  sustainVolume?: number,
  decay?: number,
  tremolo?: number,
];

export const ZZFX_SAMPLE_RATE = 44100;

/** Tvary vlny: 0 sine, 1 triangle, 2 saw, 3 tan, 4 noise. */
function shapeWave(shape: number, phase: number, curve: number): number {
  const t = phase % (Math.PI * 2);
  let v: number;
  switch (shape) {
    case 1: // triangle
      v = 1 - (4 * Math.abs(Math.round(t / (Math.PI * 2)) - t / (Math.PI * 2)));
      break;
    case 2: // saw
      v = (((t / (Math.PI * 2)) % 1) - 0.5) * 2;
      break;
    case 3: // tan — ostrý, kovový
      v = Math.max(-1, Math.min(1, Math.tan(t) / 2));
      break;
    case 4: // noise
      v = Math.sin((t % 8) ** 5);
      break;
    default:
      v = Math.sin(t);
  }
  return Math.sign(v) * Math.abs(v) ** curve;
}

/** Vygeneruje vzorky (mono, float32 v <-1,1>). */
export function zzfxGenerate(params: ZzfxParams): Float32Array<ArrayBuffer> {
  const [
    volume = 1,
    randomness = 0.05,
    frequency = 220,
    attack = 0,
    sustain = 0,
    release = 0.1,
    shape = 0,
    shapeCurve = 1,
    slide = 0,
    deltaSlide = 0,
    pitchJump = 0,
    pitchJumpTime = 0,
    repeatTime = 0,
    noise = 0,
    modulation = 0,
    bitCrush = 0,
    delay = 0,
    sustainVolume = 1,
    decay = 0,
    tremolo = 0,
  ] = params;

  const rate = ZZFX_SAMPLE_RATE;
  const sign = (v: number): number => (v > 0 ? 1 : -1);
  const PI2 = Math.PI * 2;

  let startSlide = (slide * 500 * PI2) / rate ** 2;
  let startFrequency = (frequency * (1 + randomness * (Math.random() * 2 - 1)) * PI2) / rate;
  const deltaSlideScaled = (deltaSlide * 500 * PI2) / rate ** 3;

  const attackSamples = Math.max(1, (attack * rate) | 0);
  const decaySamples = (decay * rate) | 0;
  const sustainSamples = (sustain * rate) | 0;
  const releaseSamples = (release * rate) | 0;
  const delaySamples = (delay * rate) | 0;
  const pitchJumpSamples = (pitchJumpTime * rate) | 0;
  const repeatSamples = (repeatTime * rate) | 0;
  const pitchJumpScaled = (pitchJump * PI2) / rate;
  const modulationScaled = (modulation * PI2) / rate;

  const length = attackSamples + decaySamples + sustainSamples + releaseSamples + delaySamples;
  const out = new Float32Array(length);

  let phase = 0;
  let modPhase = 0;
  let repeat = 0;
  let crushLeft = 0;
  let lastSample = 0;

  for (let i = 0; i < length; i++) {
    if (repeatSamples > 0 && ++repeat > repeatSamples) {
      repeat = 0;
      startFrequency += startSlide;
      startSlide += deltaSlideScaled;
    }
    if (pitchJumpSamples > 0 && i === pitchJumpSamples) {
      startFrequency += pitchJumpScaled;
    }

    startFrequency += startSlide;
    startSlide += deltaSlideScaled;
    phase += startFrequency * (1 + noise * (Math.random() * 2 - 1));
    modPhase += modulationScaled;

    let sample = shapeWave(shape, phase + Math.sin(modPhase) * 2, shapeCurve);

    // ADSR obálka
    let envelope: number;
    if (i < attackSamples) envelope = i / attackSamples;
    else if (i < attackSamples + decaySamples)
      envelope = 1 - ((i - attackSamples) / Math.max(1, decaySamples)) * (1 - sustainVolume);
    else if (i < attackSamples + decaySamples + sustainSamples) envelope = sustainVolume;
    else if (i < length - delaySamples)
      envelope =
        sustainVolume *
        (1 - (i - attackSamples - decaySamples - sustainSamples) / Math.max(1, releaseSamples));
    else envelope = 0;

    sample *= envelope * volume;

    if (tremolo > 0) sample *= 1 - tremolo + tremolo * Math.sin(i / 200);

    // Bit crush — snížení vzorkovací frekvence pro retro zvuk.
    if (bitCrush > 0) {
      if (crushLeft-- > 0) sample = lastSample;
      else {
        crushLeft = (bitCrush * 100) | 0;
        lastSample = sample;
      }
    }

    out[i] = Math.max(-1, Math.min(1, sign(sample) * Math.abs(sample) ** 1));
  }

  return out;
}

/** Knihovna zvuků portálu. Všechny generované, žádné soubory. */
export const SFX = {
  click: [0.4, 0.05, 720, 0.005, 0.01, 0.04, 1, 1.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.01] as ZzfxParams,
  move: [0.25, 0.05, 320, 0.003, 0.008, 0.03, 2, 1.4] as ZzfxParams,
  rotate: [0.3, 0.05, 480, 0.003, 0.01, 0.04, 1, 1.6] as ZzfxParams,
  lock: [0.4, 0.05, 180, 0.005, 0.02, 0.06, 2, 1.1, -2] as ZzfxParams,
  clear: [0.5, 0.05, 520, 0.01, 0.08, 0.15, 1, 1.3, 6, 0, 180, 0.04] as ZzfxParams,
  levelUp: [0.5, 0.05, 440, 0.02, 0.12, 0.2, 1, 1.1, 0, 0, 320, 0.06] as ZzfxParams,
  hit: [0.45, 0.1, 140, 0.002, 0.02, 0.08, 4, 1.5, -4] as ZzfxParams,
  pickup: [0.4, 0.05, 620, 0.005, 0.04, 0.08, 1, 1.2, 0, 0, 240, 0.03] as ZzfxParams,
  error: [0.4, 0.05, 180, 0.01, 0.04, 0.1, 2, 2, -8] as ZzfxParams,
  win: [0.5, 0.05, 392, 0.03, 0.2, 0.3, 1, 1, 0, 0, 196, 0.08] as ZzfxParams,
  lose: [0.45, 0.05, 220, 0.02, 0.15, 0.35, 2, 1.2, -3, -1] as ZzfxParams,
  tick: [0.2, 0.02, 1200, 0.001, 0.004, 0.01, 1, 1] as ZzfxParams,
} as const;

export type SfxName = keyof typeof SFX;
