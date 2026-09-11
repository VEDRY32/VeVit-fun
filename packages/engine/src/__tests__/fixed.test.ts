import { describe, it, expect } from 'vitest';
import {
  fx, toFloat, fxMul, fxDiv, fxSqrt, fxSin, fxCos, fxAtan2, fxFloor,
  fxLerp, fxHypot, FX_ONE, fxClamp,
} from '../math/fixed.js';

/** Fixed-point je nutný kvůli determinismu napříč prohlížeči (D-010). */
describe('fixed-point Q16.16', () => {
  it('převádí tam a zpět s přesností na 1/65536', () => {
    for (const value of [0, 1, -1, 3.5, -12.25, 1000.125]) {
      expect(toFloat(fx(value))).toBeCloseTo(value, 4);
    }
  });

  it('násobí správně', () => {
    expect(toFloat(fxMul(fx(2.5), fx(4)))).toBeCloseTo(10, 4);
    expect(toFloat(fxMul(fx(-3), fx(7)))).toBeCloseTo(-21, 4);
    expect(toFloat(fxMul(fx(0.5), fx(0.5)))).toBeCloseTo(0.25, 4);
  });

  it('dělí správně a nulu ošetří bez pádu', () => {
    expect(toFloat(fxDiv(fx(10), fx(4)))).toBeCloseTo(2.5, 4);
    expect(fxDiv(fx(1), 0)).toBe(0);
  });

  it('počítá odmocninu bez Math.sqrt', () => {
    for (const value of [1, 2, 4, 9, 16, 100, 0.25]) {
      expect(toFloat(fxSqrt(fx(value)))).toBeCloseTo(Math.sqrt(value), 2);
    }
    expect(fxSqrt(fx(-5))).toBe(0);
  });

  it('hypot odpovídá Math.hypot', () => {
    expect(toFloat(fxHypot(fx(3), fx(4)))).toBeCloseTo(5, 2);
  });

  it('sin a cos odpovídají s přesností tabulky', () => {
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      expect(toFloat(fxSin(fx(rad)))).toBeCloseTo(Math.sin(rad), 1);
      expect(toFloat(fxCos(fx(rad)))).toBeCloseTo(Math.cos(rad), 1);
    }
  });

  it('sin je deterministický a tabulkový — stejný vstup, bit-identický výstup', () => {
    const a = fxSin(fx(1.2345));
    const b = fxSin(fx(1.2345));
    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
  });

  it('atan2 dá úhel v rozumné toleranci', () => {
    const cases: [number, number][] = [[1, 1], [1, 0], [0, 1], [-1, 1], [1, -1], [-1, -1]];
    for (const [y, x] of cases) {
      expect(toFloat(fxAtan2(fx(y), fx(x)))).toBeCloseTo(Math.atan2(y, x), 1);
    }
    expect(fxAtan2(0, 0)).toBe(0);
  });

  it('floor funguje i pro záporná čísla', () => {
    expect(fxFloor(fx(3.7))).toBe(3);
    expect(fxFloor(fx(-3.2))).toBe(-4);
  });

  it('lerp a clamp drží meze', () => {
    expect(toFloat(fxLerp(fx(0), fx(10), fx(0.5)))).toBeCloseTo(5, 3);
    expect(fxClamp(fx(20), fx(0), fx(10))).toBe(fx(10));
    expect(fxClamp(fx(-5), fx(0), fx(10))).toBe(0);
  });

  it('FX_ONE je 65536', () => {
    expect(FX_ONE).toBe(65536);
  });
});
