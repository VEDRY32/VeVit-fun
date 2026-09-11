/**
 * Kostrová animace vektorových loutek.
 *
 * Postavy ve Rvačce, Válce panáčků a Aréně nejsou sprity — jsou to kostry
 * s klíčovými pózami, které se interpolují. Díky tomu nepotřebujeme žádné
 * obrázky a všechna grafika je vlastní (zadání sekce 2).
 */

export interface Bone {
  name: string;
  /** Nadřazená kost; `null` u kořene. */
  parent: string | null;
  length: number;
  /** Úhel vůči rodiči v radiánech. */
  angle: number;
  thickness: number;
  color?: string;
}

export type Pose = Record<string, number>;

export interface Skeleton {
  bones: Bone[];
  /** Kořen v souřadnicích postavy. */
  origin: { x: number; y: number };
}

export interface ResolvedBone {
  name: string;
  x1: number; y1: number;
  x2: number; y2: number;
  thickness: number;
  color?: string;
}

/** Lineární interpolace dvou póz. Chybějící kost bere úhel z kostry. */
export function blendPoses(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const from = a[key] ?? 0;
    const to = b[key] ?? 0;
    // Nejkratší cestou, aby se paže neotočila dokola přes 0/2π.
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    out[key] = from + diff * t;
  }
  return out;
}

/** Spočítá světové pozice kostí pro danou pózu. */
export function resolveSkeleton(
  skeleton: Skeleton,
  pose: Pose,
  x: number,
  y: number,
  facing: 1 | -1 = 1,
  scale = 1,
): ResolvedBone[] {
  const tips = new Map<string, { x: number; y: number; angle: number }>();
  const root = { x: x + skeleton.origin.x * facing * scale, y: y + skeleton.origin.y * scale, angle: 0 };
  const out: ResolvedBone[] = [];

  // Kosti musí být seřazené tak, aby rodič byl vždy před potomkem.
  for (const bone of skeleton.bones) {
    const parent = bone.parent == null ? root : tips.get(bone.parent);
    if (!parent) continue;
    const angle = parent.angle + (pose[bone.name] ?? bone.angle) * facing;
    const x2 = parent.x + Math.cos(angle) * bone.length * scale * facing;
    const y2 = parent.y + Math.sin(angle) * bone.length * scale;
    tips.set(bone.name, { x: x2, y: y2, angle });
    out.push({
      name: bone.name,
      x1: parent.x, y1: parent.y, x2, y2,
      thickness: bone.thickness * scale,
      color: bone.color,
    });
  }
  return out;
}

/** Vykreslí loutku jako zaoblené čáry — výrazná silueta, žádné detaily. */
export function drawPuppet(
  ctx: CanvasRenderingContext2D,
  bones: ResolvedBone[],
  defaultColor: string,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const bone of bones) {
    ctx.strokeStyle = bone.color ?? defaultColor;
    ctx.lineWidth = bone.thickness;
    ctx.beginPath();
    ctx.moveTo(bone.x1, bone.y1);
    ctx.lineTo(bone.x2, bone.y2);
    ctx.stroke();
  }
  ctx.restore();
}
