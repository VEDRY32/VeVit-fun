/**
 * Zvuková sběrnice — efekty (ZzFX) a procedurální hudba ve dvou samostatných
 * kanálech s vlastní hlasitostí.
 *
 * AudioContext se vytváří až při první interakci hráče: prohlížeče ho jinak
 * nechají v suspended stavu a první zvuk by se ztratil.
 */

import { zzfxGenerate, SFX, ZZFX_SAMPLE_RATE, type SfxName, type ZzfxParams } from './zzfx.js';
import type { Song } from './sequencer.js';
import { renderSong } from './sequencer.js';

export interface AudioSettings {
  master: number;
  sfx: number;
  music: number;
  muted: boolean;
}

export interface AudioBus {
  /** Přehraje efekt z knihovny. `rate` mění výšku (1 = původní). */
  play(name: SfxName, rate?: number): void;
  /** Přehraje vlastní parametry — pro zvuky specifické pro jednu hru. */
  playCustom(params: ZzfxParams, rate?: number): void;
  playMusic(song: Song, loop?: boolean): void;
  stopMusic(fadeMs?: number): void;
  setSettings(settings: Partial<AudioSettings>): void;
  getSettings(): AudioSettings;
  /** Zavolat z posluchače první interakce (klik, klávesa, dotyk). */
  unlock(): void;
  readonly unlocked: boolean;
  destroy(): void;
}

const DEFAULT_SETTINGS: AudioSettings = { master: 0.8, sfx: 0.9, music: 0.5, muted: false };

export function createAudioBus(initial: Partial<AudioSettings> = {}): AudioBus {
  const settings: AudioSettings = { ...DEFAULT_SETTINGS, ...initial };

  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let sfxGain: GainNode | null = null;
  let musicGain: GainNode | null = null;
  let musicSource: AudioBufferSourceNode | null = null;

  // Vygenerované efekty se cachují — přepočítávat je při každém výstřelu
  // by na mobilu shazovalo snímkovou frekvenci.
  const bufferCache = new Map<string, AudioBuffer>();

  const ensureContext = (): AudioContext | null => {
    if (ctx) return ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor({ sampleRate: ZZFX_SAMPLE_RATE });
    masterGain = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain.connect(masterGain);
    musicGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    applyGains();
    return ctx;
  };

  const applyGains = (): void => {
    if (!masterGain || !sfxGain || !musicGain) return;
    masterGain.gain.value = settings.muted ? 0 : settings.master;
    sfxGain.gain.value = settings.sfx;
    musicGain.gain.value = settings.music;
  };

  const toBuffer = (key: string, samples: Float32Array<ArrayBuffer>): AudioBuffer | null => {
    const audioCtx = ensureContext();
    if (!audioCtx) return null;
    const cached = bufferCache.get(key);
    if (cached) return cached;
    const buffer = audioCtx.createBuffer(1, samples.length, ZZFX_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    bufferCache.set(key, buffer);
    return buffer;
  };

  const playBuffer = (buffer: AudioBuffer, gain: GainNode, rate: number, loop = false): AudioBufferSourceNode | null => {
    const audioCtx = ensureContext();
    if (!audioCtx || audioCtx.state === 'closed') return null;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.loop = loop;
    source.connect(gain);
    source.start();
    return source;
  };

  return {
    play(name, rate = 1) {
      if (settings.muted || !ctx || !sfxGain) return;
      const buffer = toBuffer(`sfx:${name}`, zzfxGenerate(SFX[name]));
      if (buffer) playBuffer(buffer, sfxGain, rate);
    },

    playCustom(params, rate = 1) {
      if (settings.muted || !ctx || !sfxGain) return;
      const buffer = toBuffer(`custom:${params.join(',')}`, zzfxGenerate(params));
      if (buffer) playBuffer(buffer, sfxGain, rate);
    },

    playMusic(song, loop = true) {
      if (!ctx || !musicGain) return;
      musicSource?.stop();
      const buffer = toBuffer(`song:${song.id}`, renderSong(song));
      if (buffer) musicSource = playBuffer(buffer, musicGain, 1, loop);
    },

    stopMusic(fadeMs = 300) {
      if (!musicSource || !musicGain || !ctx) return;
      const source = musicSource;
      musicSource = null;
      // Tvrdé zastavení lupne — vyfadeujeme a teprve pak zastavíme.
      musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
      musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeMs / 1000);
      window.setTimeout(() => {
        try {
          source.stop();
        } catch {
          // zdroj už skončil sám
        }
        applyGains();
      }, fadeMs);
    },

    setSettings(next) {
      Object.assign(settings, next);
      applyGains();
    },
    getSettings: () => ({ ...settings }),

    unlock() {
      const audioCtx = ensureContext();
      if (audioCtx?.state === 'suspended') void audioCtx.resume();
    },
    get unlocked() {
      return ctx?.state === 'running';
    },

    destroy() {
      musicSource?.stop();
      bufferCache.clear();
      void ctx?.close();
      ctx = null;
    },
  };
}

/** Tichá sběrnice pro headless běh (validace replaye na serveru, testy). */
export function createSilentAudioBus(): AudioBus {
  const settings: AudioSettings = { ...DEFAULT_SETTINGS, muted: true };
  return {
    play() {},
    playCustom() {},
    playMusic() {},
    stopMusic() {},
    setSettings(next) {
      Object.assign(settings, next);
    },
    getSettings: () => ({ ...settings }),
    unlock() {},
    unlocked: false,
    destroy() {},
  };
}
