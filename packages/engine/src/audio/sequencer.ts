/**
 * Minimální sekvencer pro procedurální hudbu.
 *
 * Skladba je data: stopy, nástroje a noty v půltónech. Renderuje se do jednoho
 * bufferu, který pak běží ve smyčce — levnější než plánovat stovky oscilátorů.
 */

import { ZZFX_SAMPLE_RATE } from './zzfx.js';

export type Waveform = 'sine' | 'triangle' | 'square' | 'saw' | 'noise';

export interface Instrument {
  wave: Waveform;
  /** ADSR v sekundách; `sustain` je hlasitost 0..1, ne čas. */
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  volume: number;
  /** Rozladění druhého oscilátoru v centech — dělá zvuk hutnější. */
  detune?: number;
}

/** Nota: [půltón od A4, doba v šestnáctinách, velocity 0..1]. Půltón -128 = pauza. */
export type Note = [semitone: number, duration: number, velocity?: number];

export interface Track {
  instrument: Instrument;
  notes: Note[];
}

export interface Song {
  id: string;
  bpm: number;
  tracks: Track[];
}

export const REST = -128;

/** Frekvence tónu: A4 = 440 Hz, rovnoměrně temperované ladění. */
export const semitoneToHz = (semitone: number): number => 440 * 2 ** (semitone / 12);

function oscillator(wave: Waveform, phase: number): number {
  switch (wave) {
    case 'triangle':
      return 2 * Math.abs(2 * ((phase / (Math.PI * 2)) % 1) - 1) - 1;
    case 'square':
      return Math.sin(phase) >= 0 ? 1 : -1;
    case 'saw':
      return 2 * (((phase / (Math.PI * 2)) % 1) - 0.5);
    case 'noise':
      return Math.sin(phase * 12.9898) * 43758.5453 % 2 - 1;
    default:
      return Math.sin(phase);
  }
}

/** Vyrenderuje celou skladbu do mono bufferu. */
export function renderSong(song: Song): Float32Array<ArrayBuffer> {
  const sixteenthSec = 60 / song.bpm / 4;
  const rate = ZZFX_SAMPLE_RATE;

  const trackLengths = song.tracks.map((t) =>
    t.notes.reduce((sum, [, duration]) => sum + duration, 0),
  );
  const totalSixteenths = Math.max(1, ...trackLengths);
  const totalSamples = Math.ceil(totalSixteenths * sixteenthSec * rate);
  const out = new Float32Array(totalSamples);

  for (const track of song.tracks) {
    const { instrument } = track;
    let cursorSixteenths = 0;

    for (const [semitone, duration, velocity = 1] of track.notes) {
      const startSample = Math.floor(cursorSixteenths * sixteenthSec * rate);
      cursorSixteenths += duration;
      if (semitone === REST) continue;

      const noteSec = duration * sixteenthSec;
      const releaseSec = Math.min(instrument.release, noteSec);
      const totalSec = noteSec + releaseSec;
      const noteSamples = Math.floor(totalSec * rate);
      const hz = semitoneToHz(semitone);
      const step = (hz * Math.PI * 2) / rate;
      const detuneStep = instrument.detune
        ? (hz * 2 ** (instrument.detune / 1200) * Math.PI * 2) / rate
        : 0;

      const attackSamples = Math.max(1, instrument.attack * rate);
      const decaySamples = Math.max(1, instrument.decay * rate);
      const sustainEnd = noteSec * rate;

      for (let i = 0; i < noteSamples; i++) {
        const index = startSample + i;
        if (index >= totalSamples) break;

        let envelope: number;
        if (i < attackSamples) envelope = i / attackSamples;
        else if (i < attackSamples + decaySamples)
          envelope = 1 - ((i - attackSamples) / decaySamples) * (1 - instrument.sustain);
        else if (i < sustainEnd) envelope = instrument.sustain;
        else envelope = instrument.sustain * Math.max(0, 1 - (i - sustainEnd) / (releaseSec * rate));

        let sample = oscillator(instrument.wave, i * step);
        if (detuneStep > 0) sample = (sample + oscillator(instrument.wave, i * detuneStep)) * 0.5;

        out[index] = (out[index] ?? 0) + sample * envelope * instrument.volume * velocity;
      }
    }
  }

  // Měkká limitace — součet stop běžně přeteče a tvrdý ořez by chraptěl.
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.tanh((out[i] ?? 0) * 0.8);
  }
  return out;
}

export const INSTRUMENTS: Record<string, Instrument> = {
  pad: { wave: 'triangle', attack: 0.08, decay: 0.3, sustain: 0.55, release: 0.4, volume: 0.28, detune: 8 },
  lead: { wave: 'square', attack: 0.01, decay: 0.08, sustain: 0.5, release: 0.12, volume: 0.2 },
  bass: { wave: 'saw', attack: 0.005, decay: 0.12, sustain: 0.4, release: 0.1, volume: 0.3 },
  pluck: { wave: 'triangle', attack: 0.002, decay: 0.14, sustain: 0.05, release: 0.1, volume: 0.26 },
  drum: { wave: 'noise', attack: 0.001, decay: 0.06, sustain: 0, release: 0.04, volume: 0.22 },
};
