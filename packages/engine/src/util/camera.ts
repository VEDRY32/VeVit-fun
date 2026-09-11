/** Kamera se sledováním a otřesem. Otřes jde vypnout v nastavení přístupnosti. */

import { lerp } from './tween.js';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  /** Plynule dojede k cíli. `stiffness` 0..1 — kolik rozdílu ujede za krok. */
  follow(targetX: number, targetY: number, stiffness?: number): void;
  shake(intensity: number, ticks: number): void;
  update(): void;
  /** Aplikuje transformaci na kontext. Ukončit `ctx.restore()`. */
  apply(ctx: CanvasRenderingContext2D, viewWidth: number, viewHeight: number): void;
  setShakeEnabled(enabled: boolean): void;
}

export function createCamera(x = 0, y = 0, shakeEnabled = true): Camera {
  let shakeIntensity = 0;
  let shakeTicks = 0;
  let shakeOffsetX = 0;
  let shakeOffsetY = 0;
  let enabled = shakeEnabled;

  // Vlastní deterministický šum — kamera se netýká herní logiky, ale
  // nechceme ani tady `Math.random`, ať jsou screenshoty reprodukovatelné.
  let noiseSeed = 1;
  const noise = (): number => {
    noiseSeed = (noiseSeed * 1103515245 + 12345) & 0x7fffffff;
    return (noiseSeed / 0x7fffffff) * 2 - 1;
  };

  const camera: Camera = {
    x, y, zoom: 1,

    follow(targetX, targetY, stiffness = 0.12) {
      camera.x = lerp(camera.x, targetX, stiffness);
      camera.y = lerp(camera.y, targetY, stiffness);
    },

    shake(intensity, ticks) {
      if (!enabled) return;
      // Slabší otřes nepřebije silnější, který zrovna běží.
      if (intensity >= shakeIntensity) {
        shakeIntensity = intensity;
        shakeTicks = ticks;
      }
    },

    update() {
      if (shakeTicks > 0) {
        shakeTicks--;
        const falloff = shakeTicks / 20;
        shakeOffsetX = noise() * shakeIntensity * Math.min(1, falloff);
        shakeOffsetY = noise() * shakeIntensity * Math.min(1, falloff);
        if (shakeTicks === 0) shakeIntensity = 0;
      } else {
        shakeOffsetX = 0;
        shakeOffsetY = 0;
      }
    },

    apply(ctx, viewWidth, viewHeight) {
      ctx.save();
      ctx.translate(viewWidth / 2, viewHeight / 2);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-camera.x + shakeOffsetX, -camera.y + shakeOffsetY);
    },

    setShakeEnabled(value) {
      enabled = value;
      if (!value) {
        shakeTicks = 0;
        shakeIntensity = 0;
        shakeOffsetX = 0;
        shakeOffsetY = 0;
      }
    },
  };

  return camera;
}
