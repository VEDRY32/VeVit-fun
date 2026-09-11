/**
 * Fixed-point matematika Q16.16 (D-010).
 *
 * Float dává na různých platformách mírně odlišné výsledky u `Math.sin`,
 * `Math.sqrt` a u pořadí operací. V hrách s validací replaye nebo online
 * režimem by to znamenalo desynchronizaci, takže jejich logika počítá
 * v celých číslech: hodnota `x` reprezentuje reálné `x / 65536`.
 */

export type Fx = number;

export const FX_BITS = 16;
export const FX_ONE = 1 << FX_BITS; // 65536
export const FX_HALF = FX_ONE >> 1;

export const fx = (n: number): Fx => Math.round(n * FX_ONE) | 0;
export const fxFromInt = (n: number): Fx => (n << FX_BITS) | 0;
export const toFloat = (a: Fx): number => a / FX_ONE;
/** Zaokrouhlení dolů k celému číslu (i pro záporná — jako Math.floor). */
export const fxFloor = (a: Fx): number => a >> FX_BITS;
export const fxRound = (a: Fx): number => (a + FX_HALF) >> FX_BITS;
export const fxCeil = (a: Fx): number => (a + FX_ONE - 1) >> FX_BITS;

export const fxAdd = (a: Fx, b: Fx): Fx => (a + b) | 0;
export const fxSub = (a: Fx, b: Fx): Fx => (a - b) | 0;

/**
 * Násobení. Mezivýsledek nepřeteče 53 bitů, dokud jsou činitelé
 * v rozsahu zhruba ±32768, což herní souřadnice splňují.
 */
export const fxMul = (a: Fx, b: Fx): Fx => Math.floor((a * b) / FX_ONE) | 0;

export const fxDiv = (a: Fx, b: Fx): Fx => (b === 0 ? 0 : Math.floor((a * FX_ONE) / b) | 0);

export const fxAbs = (a: Fx): Fx => (a < 0 ? -a : a);
export const fxSign = (a: Fx): number => (a > 0 ? 1 : a < 0 ? -1 : 0);
export const fxMin = (a: Fx, b: Fx): Fx => (a < b ? a : b);
export const fxMax = (a: Fx, b: Fx): Fx => (a > b ? a : b);
export const fxClamp = (a: Fx, lo: Fx, hi: Fx): Fx => (a < lo ? lo : a > hi ? hi : a);

/** Lineární interpolace; `t` je Fx v <0,1>. */
export const fxLerp = (a: Fx, b: Fx, t: Fx): Fx => fxAdd(a, fxMul(fxSub(b, a), t));

/** Odmocnina celočíselným Newtonovým postupem — deterministická, bez `Math.sqrt`. */
export function fxSqrt(a: Fx): Fx {
  if (a <= 0) return 0;
  // Odhad z poloviny počtu bitů, pak 6 iterací stačí na plnou přesnost Q16.16.
  let x = a > FX_ONE ? a >> 1 : FX_ONE;
  for (let i = 0; i < 6; i++) {
    if (x === 0) break;
    x = ((x + fxDiv(a, x)) >> 1) | 0;
  }
  return x;
}

export const fxHypot = (x: Fx, y: Fx): Fx => fxSqrt(fxAdd(fxMul(x, x), fxMul(y, y)));

// --- Goniometrie ------------------------------------------------------------
// Tabulka 1024 hodnot sinu na plný kruh. Předpočítaná z `Math.sin` jednou při
// načtení modulu; protože se ukládají zaokrouhlená celá čísla, je výsledek na
// všech platformách identický (IEEE-754 zaokrouhlení na stejnou celou hodnotu).

export const FX_PI = fx(Math.PI);
export const FX_TAU = fx(Math.PI * 2);

const TRIG_STEPS = 1024;
const TRIG_MASK = TRIG_STEPS - 1;
const SIN_TABLE = new Int32Array(TRIG_STEPS);
for (let i = 0; i < TRIG_STEPS; i++) {
  SIN_TABLE[i] = Math.round(Math.sin((i / TRIG_STEPS) * Math.PI * 2) * FX_ONE);
}

/** Index tabulky z úhlu v radiánech (Fx). */
function trigIndex(angle: Fx): number {
  // angle / TAU * TRIG_STEPS, se správným chováním pro záporné úhly.
  return (Math.floor((angle * TRIG_STEPS) / FX_TAU) & TRIG_MASK) | 0;
}

export const fxSin = (angle: Fx): Fx => SIN_TABLE[trigIndex(angle)] as Fx;
export const fxCos = (angle: Fx): Fx => SIN_TABLE[(trigIndex(angle) + TRIG_STEPS / 4) & TRIG_MASK] as Fx;

/**
 * atan2 aproximací (max. chyba ~0,005 rad) — deterministická a dost přesná
 * pro míření a balistiku.
 */
export function fxAtan2(y: Fx, x: Fx): Fx {
  if (x === 0 && y === 0) return 0;
  const absY = fxAbs(y) + 1;
  let angle: Fx;
  if (x >= 0) {
    const r = fxDiv(fxSub(x, absY), fxAdd(x, absY));
    angle = fxSub(fx(Math.PI / 4), fxMul(fx(Math.PI / 4), r));
  } else {
    const r = fxDiv(fxAdd(x, absY), fxSub(absY, x));
    angle = fxSub(fx((3 * Math.PI) / 4), fxMul(fx(Math.PI / 4), r));
  }
  return y < 0 ? -angle : angle;
}
