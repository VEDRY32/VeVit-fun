/**
 * Vektorové ilustrace na karty.
 *
 * Každý motiv je funkce, která nakreslí obrázek do čtverce 100×100 v počátku.
 * Žádné obrázky ani cizí assety — kreslí se procedurálně (zadání sekce 2).
 * Motiv, pro který zatím kresba není, dostane rozlišitelný geometrický znak
 * odvozený z názvu, aby hra fungovala i s rozšířenou sadou.
 */

type Draw = (ctx: CanvasRenderingContext2D, color: string) => void;

const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

const MOTIF_DRAWINGS: Record<string, Draw> = {
  jezek: (c, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(50, 58, 34, 24, 0, 0, Math.PI * 2);
    c.fill();
    // Bodliny jako trojúhelníky po obvodu hřbetu.
    for (let i = 0; i < 9; i++) {
      const angle = Math.PI + (i / 8) * Math.PI;
      c.beginPath();
      c.moveTo(50 + Math.cos(angle) * 30, 58 + Math.sin(angle) * 20);
      c.lineTo(50 + Math.cos(angle) * 44, 58 + Math.sin(angle) * 34);
      c.lineTo(50 + Math.cos(angle + 0.22) * 30, 58 + Math.sin(angle + 0.22) * 20);
      c.closePath();
      c.fill();
    }
    c.fillStyle = '#0F1C3F';
    circle(c, 78, 56, 3);
  },
  liska: (c, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(50, 84);
    c.lineTo(20, 40);
    c.lineTo(34, 46);
    c.lineTo(30, 20);
    c.lineTo(48, 38);
    c.lineTo(52, 38);
    c.lineTo(70, 20);
    c.lineTo(66, 46);
    c.lineTo(80, 40);
    c.closePath();
    c.fill();
    c.fillStyle = '#0F1C3F';
    circle(c, 40, 50, 4);
    circle(c, 60, 50, 4);
  },
  sova: (c, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(50, 54, 30, 34, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#0F1C3F';
    circle(c, 38, 46, 10);
    circle(c, 62, 46, 10);
    c.fillStyle = color;
    circle(c, 38, 46, 4);
    circle(c, 62, 46, 4);
    c.fillStyle = '#0F1C3F';
    c.beginPath();
    c.moveTo(46, 58);
    c.lineTo(54, 58);
    c.lineTo(50, 68);
    c.closePath();
    c.fill();
  },
  jablko: (c, color) => {
    c.fillStyle = color;
    circle(c, 40, 58, 24);
    circle(c, 60, 58, 24);
    c.fillStyle = '#5FD9A0';
    c.beginPath();
    c.ellipse(62, 28, 14, 7, -0.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#8B6B4A';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(50, 36);
    c.lineTo(50, 22);
    c.stroke();
  },
  hruska: (c, color) => {
    c.fillStyle = color;
    circle(c, 50, 64, 24);
    circle(c, 50, 40, 15);
    c.strokeStyle = '#8B6B4A';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(50, 26);
    c.lineTo(52, 14);
    c.stroke();
  },
  raketa: (c, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(50, 12);
    c.quadraticCurveTo(70, 44, 66, 74);
    c.lineTo(34, 74);
    c.quadraticCurveTo(30, 44, 50, 12);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(34, 60);
    c.lineTo(18, 82);
    c.lineTo(34, 76);
    c.closePath();
    c.moveTo(66, 60);
    c.lineTo(82, 82);
    c.lineTo(66, 76);
    c.closePath();
    c.fill();
    c.fillStyle = '#0F1C3F';
    circle(c, 50, 40, 9);
  },
  planeta: (c, color) => {
    c.fillStyle = color;
    circle(c, 50, 50, 26);
    c.strokeStyle = color;
    c.lineWidth = 5;
    c.beginPath();
    c.ellipse(50, 52, 44, 13, -0.35, 0, Math.PI * 2);
    c.stroke();
  },
  vlak: (c, color) => {
    c.fillStyle = color;
    c.fillRect(18, 40, 50, 30);
    c.fillRect(62, 30, 22, 40);
    c.fillStyle = '#0F1C3F';
    circle(c, 32, 74, 8);
    circle(c, 58, 74, 8);
    circle(c, 76, 74, 8);
    c.fillStyle = '#EEF2FF';
    c.fillRect(66, 38, 14, 12);
  },
  tramvaj: (c, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(22, 68);
    c.lineTo(22, 36);
    c.quadraticCurveTo(50, 26, 78, 36);
    c.lineTo(78, 68);
    c.closePath();
    c.fill();
    c.fillStyle = '#EEF2FF';
    c.fillRect(30, 42, 18, 14);
    c.fillRect(54, 42, 18, 14);
    c.fillStyle = '#0F1C3F';
    circle(c, 36, 74, 7);
    circle(c, 64, 74, 7);
  },
  kolo: (c, color) => {
    c.strokeStyle = color;
    c.lineWidth = 5;
    c.beginPath();
    c.arc(28, 62, 18, 0, Math.PI * 2);
    c.moveTo(90, 62);
    c.arc(72, 62, 18, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(28, 62);
    c.lineTo(46, 34);
    c.lineTo(72, 62);
    c.moveTo(46, 34);
    c.lineTo(60, 34);
    c.stroke();
  },
};

/**
 * Záložní kresba pro motiv bez vlastní ilustrace: geometrický znak
 * odvozený z názvu. Různé motivy dostanou rozlišitelný tvar i počet prvků.
 */
function fallbackDrawing(motif: string): Draw {
  let hash = 0;
  for (const char of motif) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const shape = Math.abs(hash) % 4;
  const count = 2 + (Math.abs(hash >> 4) % 4);

  return (c, color) => {
    c.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.abs(hash) % 7) * 0.2;
      const x = 50 + Math.cos(angle) * 22;
      const y = 50 + Math.sin(angle) * 22;
      if (shape === 0) circle(c, x, y, 11);
      else if (shape === 1) c.fillRect(x - 10, y - 10, 20, 20);
      else if (shape === 2) {
        c.beginPath();
        c.moveTo(x, y - 12);
        c.lineTo(x + 11, y + 8);
        c.lineTo(x - 11, y + 8);
        c.closePath();
        c.fill();
      } else {
        c.save();
        c.translate(x, y);
        c.rotate(Math.PI / 4);
        c.fillRect(-9, -9, 18, 18);
        c.restore();
      }
    }
  };
}

const cache = new Map<string, Draw>();

export function drawMotif(
  ctx: CanvasRenderingContext2D,
  motif: string,
  x: number, y: number, size: number, color: string,
): void {
  // Motivy s pořadovým číslem (opakované sady) sdílí kresbu se základem.
  const base = motif.replace(/-\d+$/, '');
  let draw = cache.get(base);
  if (!draw) {
    draw = MOTIF_DRAWINGS[base] ?? fallbackDrawing(base);
    cache.set(base, draw);
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  draw(ctx, color);
  ctx.restore();
}
