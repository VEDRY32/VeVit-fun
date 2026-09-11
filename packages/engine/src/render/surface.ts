/**
 * Plátno s logickým rozlišením.
 *
 * Hra kreslí vždy do svých vlastních souřadnic (např. 480×640). Surface se
 * postará o devicePixelRatio, letterbox v barvě kategorie a o to, aby retro
 * hry měly ostré pixely a ostatní hladké vyhlazení.
 */

export interface SurfaceOptions {
  logicalWidth: number;
  logicalHeight: number;
  /** Barva pruhů okolo herní plochy. */
  letterbox: string;
  /** `true` u retro arkád — vypne vyhlazování a zaokrouhlí měřítko. */
  pixelArt?: boolean;
  /** Strop pro devicePixelRatio; na mobilu 3× DPR zbytečně pálí baterii. */
  maxDpr?: number;
}

export interface Surface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  /** Aktuální měřítko z logických na CSS pixely. */
  readonly scale: number;
  /** Přepočet z okna do logických souřadnic hry. */
  toLogical(clientX: number, clientY: number): { x: number; y: number };
  /** Nastaví transformaci a vyčistí plochu. Volat na začátku každého snímku. */
  begin(): void;
  resize(): void;
  destroy(): void;
}

export function createSurface(container: HTMLElement, options: SurfaceOptions): Surface {
  const { logicalWidth, logicalHeight, letterbox, pixelArt = false, maxDpr = 2 } = options;

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  canvas.style.backgroundColor = letterbox;
  if (pixelArt) canvas.style.imageRendering = 'pixelated';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D kontext není dostupný.');

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dpr = 1;

  const resize = (): void => {
    const rect = container.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.floor(rect.width));
    const cssHeight = Math.max(1, Math.floor(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const fit = Math.min(cssWidth / logicalWidth, cssHeight / logicalHeight);
    // U pixel-artu celočíselné měřítko, jinak by se pixely rozmazaly nerovnoměrně.
    scale = pixelArt ? Math.max(1, Math.floor(fit)) : fit;

    offsetX = (cssWidth - logicalWidth * scale) / 2;
    offsetY = (cssHeight - logicalHeight * scale) / 2;

    ctx.imageSmoothingEnabled = !pixelArt;
  };

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  return {
    canvas,
    ctx,
    width: logicalWidth,
    height: logicalHeight,
    get scale() {
      return scale;
    },

    toLogical(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left - offsetX) / scale,
        y: (clientY - rect.top - offsetY) / scale,
      };
    },

    begin() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = letterbox;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
      // Ořez na herní plochu, ať hra nemůže omylem kreslit do letterboxu.
      ctx.beginPath();
      ctx.rect(0, 0, logicalWidth, logicalHeight);
      ctx.clip();
    },

    resize,

    destroy() {
      observer.disconnect();
      canvas.remove();
    },
  };
}
