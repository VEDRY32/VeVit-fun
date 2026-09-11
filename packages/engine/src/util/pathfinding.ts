/**
 * Hledání cesty v mřížce — A* a BFS.
 * Používá Skladník (tap = postavička dojde), Hladovec (AI pronásledovatelů)
 * a Obrana věže (cesta nepřátel).
 */

export interface GridLike {
  width: number;
  height: number;
  /** `true`, když se na pole dá vstoupit. */
  passable(x: number, y: number): boolean;
}

export interface Point {
  x: number;
  y: number;
}

const NEIGHBOURS: readonly Point[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
];

/**
 * Nejkratší cesta ze `start` do `goal` včetně obou konců.
 * `null`, když cesta neexistuje.
 */
export function findPath(grid: GridLike, start: Point, goal: Point): Point[] | null {
  if (!grid.passable(goal.x, goal.y)) return null;
  const index = (x: number, y: number): number => y * grid.width + x;

  const gScore = new Int32Array(grid.width * grid.height).fill(-1);
  const cameFrom = new Int32Array(grid.width * grid.height).fill(-1);

  // Binární halda; pro mřížky do ~10 000 polí je to výrazně rychlejší než
  // lineární hledání minima.
  const heap: { idx: number; f: number }[] = [];
  const push = (idx: number, f: number): void => {
    heap.push({ idx, f });
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((heap[parent] as { f: number }).f <= (heap[i] as { f: number }).f) break;
      [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
      i = parent;
    }
  };
  const pop = (): { idx: number; f: number } | undefined => {
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < heap.length && heap[l]!.f < heap[smallest]!.f) smallest = l;
        if (r < heap.length && heap[r]!.f < heap[smallest]!.f) smallest = r;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i]!, heap[smallest]!];
        i = smallest;
      }
    }
    return top;
  };

  const manhattan = (x: number, y: number): number => Math.abs(x - goal.x) + Math.abs(y - goal.y);

  const startIdx = index(start.x, start.y);
  const goalIdx = index(goal.x, goal.y);
  gScore[startIdx] = 0;
  push(startIdx, manhattan(start.x, start.y));

  while (heap.length > 0) {
    const current = pop()!;
    if (current.idx === goalIdx) break;
    const cx = current.idx % grid.width;
    const cy = (current.idx / grid.width) | 0;
    const currentG = gScore[current.idx]!;

    for (const n of NEIGHBOURS) {
      const nx = cx + n.x;
      const ny = cy + n.y;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      if (!grid.passable(nx, ny)) continue;
      const nIdx = index(nx, ny);
      const tentative = currentG + 1;
      if (gScore[nIdx] !== -1 && gScore[nIdx]! <= tentative) continue;
      gScore[nIdx] = tentative;
      cameFrom[nIdx] = current.idx;
      push(nIdx, tentative + manhattan(nx, ny));
    }
  }

  if (gScore[goalIdx] === -1) return null;

  const path: Point[] = [];
  let idx = goalIdx;
  while (idx !== -1) {
    path.push({ x: idx % grid.width, y: (idx / grid.width) | 0 });
    if (idx === startIdx) break;
    idx = cameFrom[idx]!;
  }
  return path.reverse();
}

/** Vzdálenostní mapa od jednoho bodu — levnější než A* pro „kdo je nejblíž". */
export function distanceField(grid: GridLike, from: Point): Int32Array {
  const dist = new Int32Array(grid.width * grid.height).fill(-1);
  const queue: number[] = [from.y * grid.width + from.x];
  dist[queue[0]!] = 0;
  let head = 0;

  while (head < queue.length) {
    const idx = queue[head++]!;
    const cx = idx % grid.width;
    const cy = (idx / grid.width) | 0;
    for (const n of NEIGHBOURS) {
      const nx = cx + n.x;
      const ny = cy + n.y;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      if (!grid.passable(nx, ny)) continue;
      const nIdx = ny * grid.width + nx;
      if (dist[nIdx] !== -1) continue;
      dist[nIdx] = dist[idx]! + 1;
      queue.push(nIdx);
    }
  }
  return dist;
}
