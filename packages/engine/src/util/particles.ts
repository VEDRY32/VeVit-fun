/**
 * Částicový systém s předalokovaným poolem.
 *
 * Alokovat objekty za běhu znamená pauzy garbage collectoru uprostřed hry,
 * takže pole má pevnou velikost a mrtvé částice se recyklují.
 */

import type { Rng } from '../rng.js';

interface Particle {
  alive: boolean;
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
}

export interface EmitOptions {
  x: number; y: number;
  count: number;
  color: string;
  speed?: number;
  speedVariance?: number;
  life?: number;
  size?: number;
  gravity?: number;
  drag?: number;
  /** Směr výtrysku v radiánech; `undefined` = do všech stran. */
  angle?: number;
  spread?: number;
}

export interface ParticleSystem {
  emit(options: EmitOptions): void;
  update(): void;
  render(ctx: CanvasRenderingContext2D): void;
  clear(): void;
  readonly activeCount: number;
}

export function createParticles(rng: Rng, capacity = 400): ParticleSystem {
  const pool: Particle[] = Array.from({ length: capacity }, () => ({
    alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
    size: 2, color: '#fff', gravity: 0, drag: 1,
  }));
  let cursor = 0;
  let active = 0;

  return {
    emit(options) {
      const {
        x, y, count, color,
        speed = 2, speedVariance = 1, life = 30, size = 3,
        gravity = 0.08, drag = 0.98, angle, spread = Math.PI * 2,
      } = options;

      for (let i = 0; i < count; i++) {
        // Když je pool plný, přepíšeme nejstarší — lepší než přestat emitovat.
        const p = pool[cursor] as Particle;
        cursor = (cursor + 1) % capacity;
        if (!p.alive) active++;

        const dir = angle == null ? rng.range(0, Math.PI * 2) : angle + rng.range(-spread / 2, spread / 2);
        const v = speed + rng.range(-speedVariance, speedVariance);
        p.alive = true;
        p.x = x; p.y = y;
        p.vx = Math.cos(dir) * v;
        p.vy = Math.sin(dir) * v;
        p.maxLife = life;
        p.life = life;
        p.size = size;
        p.color = color;
        p.gravity = gravity;
        p.drag = drag;
      }
    },

    update() {
      for (const p of pool) {
        if (!p.alive) continue;
        p.vy += p.gravity;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx;
        p.y += p.vy;
        if (--p.life <= 0) {
          p.alive = false;
          active--;
        }
      }
    },

    render(ctx) {
      ctx.save();
      for (const p of pool) {
        if (!p.alive) continue;
        const t = p.life / p.maxLife;
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        const s = p.size * t;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.restore();
    },

    clear() {
      for (const p of pool) p.alive = false;
      active = 0;
    },

    get activeCount() {
      return active;
    },
  };
}
