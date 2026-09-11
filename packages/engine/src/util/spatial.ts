/**
 * Prostorová hash mapa pro kolize v otevřeném světě (Buňky.io, Hadi.io).
 * Bez ní by 50 hráčů a tisíce jídel znamenalo kvadratické porovnávání.
 */

export interface SpatialItem {
  x: number;
  y: number;
  r: number;
}

export interface SpatialHash<T extends SpatialItem> {
  clear(): void;
  insert(item: T): void;
  /** Vrátí kandidáty v okruhu; volající musí ještě ověřit skutečnou vzdálenost. */
  query(x: number, y: number, radius: number): T[];
  /** Kandidáti v obdélníku — pro výřez zorného pole. */
  queryRect(x: number, y: number, w: number, h: number): T[];
  readonly size: number;
}

export function createSpatialHash<T extends SpatialItem>(cellSize = 128): SpatialHash<T> {
  const cells = new Map<number, T[]>();
  let count = 0;

  // Klíč buňky do jednoho čísla — Map s number klíčem je výrazně rychlejší než se stringem.
  const key = (cx: number, cy: number): number => ((cx & 0xffff) << 16) | (cy & 0xffff);

  return {
    clear() {
      cells.clear();
      count = 0;
    },

    insert(item) {
      // Velký objekt patří do všech buněk, které protíná.
      const minX = Math.floor((item.x - item.r) / cellSize);
      const maxX = Math.floor((item.x + item.r) / cellSize);
      const minY = Math.floor((item.y - item.r) / cellSize);
      const maxY = Math.floor((item.y + item.r) / cellSize);
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
          const k = key(cx, cy);
          const bucket = cells.get(k);
          if (bucket) bucket.push(item);
          else cells.set(k, [item]);
        }
      }
      count++;
    },

    query(x, y, radius) {
      const minX = Math.floor((x - radius) / cellSize);
      const maxX = Math.floor((x + radius) / cellSize);
      const minY = Math.floor((y - radius) / cellSize);
      const maxY = Math.floor((y + radius) / cellSize);
      const seen = new Set<T>();
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
          for (const item of cells.get(key(cx, cy)) ?? []) seen.add(item);
        }
      }
      return [...seen];
    },

    queryRect(x, y, w, h) {
      const minX = Math.floor(x / cellSize);
      const maxX = Math.floor((x + w) / cellSize);
      const minY = Math.floor(y / cellSize);
      const maxY = Math.floor((y + h) / cellSize);
      const seen = new Set<T>();
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
          for (const item of cells.get(key(cx, cy)) ?? []) seen.add(item);
        }
      }
      return [...seen];
    },

    get size() {
      return count;
    },
  };
}
