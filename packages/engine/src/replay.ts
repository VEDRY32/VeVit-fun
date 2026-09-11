/**
 * Záznam vstupů pro serverovou validaci skóre (D-008).
 *
 * Ukládá se běhová délka: většinu kroků se maska vstupů nemění, takže místo
 * 60 hodnot za sekundu stačí „tahle maska platila N kroků". Typický běh
 * Kostkopádu tím spadne z desítek kB na jednotky.
 */

export const REPLAY_MAGIC = 0x5656; // "VV"
export const REPLAY_VERSION = 1;

export interface ReplayMeta {
  gameSlug: string;
  mode: string;
  seed: string;
  rulesVersion: number;
  /** Verze klienta — při nesouladu server běh nezamítne, ale označí. */
  clientVersion: string;
}

export interface ReplayRecorder {
  /** Zapíše masku vstupů pro právě proběhlý krok logiky. */
  record(mask: number): void;
  /** Ukončí záznam a vrátí binární podobu. */
  finish(): Uint8Array;
  readonly ticks: number;
}

export interface Replay {
  meta: ReplayMeta;
  /** Masky vstupů pro každý krok, rozbalené. */
  masks: Uint16Array;
}

function writeString(bytes: number[], text: string): void {
  const encoded = new TextEncoder().encode(text);
  if (encoded.length > 255) throw new Error('Řetězec v replayi je delší než 255 bajtů.');
  bytes.push(encoded.length, ...encoded);
}

function writeVarint(bytes: number[], value: number): void {
  let v = value >>> 0;
  while (v >= 0x80) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);
}

export function createReplayRecorder(meta: ReplayMeta, maxTicks = 60 * 60 * 90): ReplayRecorder {
  const runs: { mask: number; count: number }[] = [];
  let ticks = 0;

  return {
    record(mask) {
      // Strop je pojistka proti zacyklené hře, která by nafoukla payload.
      if (ticks >= maxTicks) return;
      ticks++;
      const last = runs[runs.length - 1];
      if (last && last.mask === mask && last.count < 0xffff) last.count++;
      else runs.push({ mask, count: 1 });
    },

    finish() {
      const bytes: number[] = [];
      bytes.push(REPLAY_MAGIC >> 8, REPLAY_MAGIC & 0xff, REPLAY_VERSION);
      writeString(bytes, meta.gameSlug);
      writeString(bytes, meta.mode);
      writeString(bytes, meta.seed);
      writeVarint(bytes, meta.rulesVersion);
      writeString(bytes, meta.clientVersion);
      writeVarint(bytes, ticks);
      writeVarint(bytes, runs.length);
      for (const run of runs) {
        writeVarint(bytes, run.mask);
        writeVarint(bytes, run.count);
      }
      return new Uint8Array(bytes);
    },

    get ticks() {
      return ticks;
    },
  };
}

class Reader {
  private offset = 0;
  constructor(private readonly bytes: Uint8Array) {}

  u8(): number {
    if (this.offset >= this.bytes.length) throw new Error('Replay je useknutý.');
    return this.bytes[this.offset++]!;
  }

  varint(): number {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = this.u8();
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
      if (shift > 35) throw new Error('Poškozený varint v replayi.');
    }
    return result >>> 0;
  }

  string(): string {
    const length = this.u8();
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    if (slice.length < length) throw new Error('Replay je useknutý.');
    this.offset += length;
    return new TextDecoder().decode(slice);
  }
}

/**
 * Rozbalí replay. Vstup je nedůvěryhodný (přichází od klienta), takže se
 * kontroluje magic, verze i délka — poškozený replay skončí výjimkou,
 * ne nekonečným cyklem.
 */
export function parseReplay(bytes: Uint8Array, maxTicks = 60 * 60 * 90): Replay {
  const reader = new Reader(bytes);
  const magic = (reader.u8() << 8) | reader.u8();
  if (magic !== REPLAY_MAGIC) throw new Error('Tohle není replay VeVit Games.');
  const version = reader.u8();
  if (version !== REPLAY_VERSION) throw new Error(`Neznámá verze replaye: ${version}.`);

  const meta: ReplayMeta = {
    gameSlug: reader.string(),
    mode: reader.string(),
    seed: reader.string(),
    rulesVersion: reader.varint(),
    clientVersion: reader.string(),
  };

  const ticks = reader.varint();
  if (ticks > maxTicks) throw new Error('Replay je nepřiměřeně dlouhý.');
  const runCount = reader.varint();
  if (runCount > ticks) throw new Error('Replay má víc úseků než kroků.');

  const masks = new Uint16Array(ticks);
  let cursor = 0;
  for (let i = 0; i < runCount; i++) {
    const mask = reader.varint();
    const count = reader.varint();
    if (cursor + count > ticks) throw new Error('Úseky replaye přesahují deklarovanou délku.');
    masks.fill(mask, cursor, cursor + count);
    cursor += count;
  }
  if (cursor !== ticks) throw new Error('Úseky replaye nepokrývají celou délku.');

  return { meta, masks };
}
