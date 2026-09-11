/** Kreslicí pomůcky sdílené hrami — všechno vektorově, žádné obrázky. */

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Dlaždice se zkoseným rohem — tvarový motiv portálu (herní kazeta). */
export function notchedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number, notch: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - notch, y);
  ctx.lineTo(x + w, y + notch);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Skleněná dlaždice s vnitřní hranou — základní vzhled kostek a kamenů.
 * Vlastní paleta, žádné kanonické barvy originálů (D-012).
 */
export function glassTile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number, color: string, alpha = 1,
): void {
  const inset = Math.max(1, size * 0.06);
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = color;
  roundRect(ctx, x + inset, y + inset, size - inset * 2, size - inset * 2, size * 0.18);
  ctx.fill();

  // Světlá hrana nahoře/vlevo, tmavá dole/vpravo — dojem hloubky bez stínu.
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha * 0.28;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x + inset, y + size - inset);
  ctx.lineTo(x + inset, y + inset);
  ctx.lineTo(x + size - inset, y + inset);
  ctx.lineTo(x + size - inset * 2.4, y + inset * 2.4);
  ctx.lineTo(x + inset * 2.4, y + inset * 2.4);
  ctx.lineTo(x + inset * 2.4, y + size - inset * 2.4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/** Text na střed dané pozice, s volitelným obrysem pro čitelnost nad hrou. */
export function centerText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  font: string, color: string, outline?: string,
): void {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = outline;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Barva s upravenou průhledností. Přijímá #rgb, #rrggbb i rgb(). */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

/** Posun barvy do světla (t > 0) nebo do tmy (t < 0), t v <-1,1>. */
export function shade(color: string, t: number): string {
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const shifted = channels.map((c) => {
    const target = t > 0 ? 255 : 0;
    return Math.round(c + (target - c) * Math.abs(t));
  });
  return `#${shifted.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
