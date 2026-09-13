/**
 * Sdílená plošinovková fyzika.
 *
 * Několik her portálu je z boku, s gravitací a dlaždicovou mapou:
 * Super skokan, Oheň a Voda, Nájezdník i Pouliční bitka. Kdyby si každá
 * psala vlastní řešení kolizí, rozejdou se v detailech, které hráč cítí —
 * jak vysoko se doskočí, jestli se dá klouzat po stěně, jestli postava
 * projde rohem. Tenhle modul je proto jediné místo, kde se to řeší.
 *
 * Osy se řeší odděleně (nejdřív X, pak Y). Je to nutné: kdyby se posun
 * vyhodnotil najednou, postava by se u rohu dlaždice zasekla nebo skrz ni
 * proklouzla podle toho, která složka rychlosti je větší.
 *
 * Vše je čistě aritmetické a bez náhody, takže je běh přehratelný (D-008).
 */

export interface TileGrid {
  /** Rozměry v dlaždicích. */
  width: number;
  height: number;
  /** Velikost dlaždice v herních pixelech. */
  tile: number;
  /** Je dlaždice pevná? Mimo mapu vrací, co má být za okrajem. */
  solid(tx: number, ty: number): boolean;
}

export interface Body {
  /** Levý horní roh v herních pixelech. */
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  /** Stojí tělo v tomhle kroku na pevné dlaždici? */
  onGround: boolean;
  /** Narazilo tělo v tomhle kroku do svislé stěny? Pro odrazy nepřátel. */
  hitWall: boolean;
  /** Narazilo tělo hlavou do stropu? */
  hitCeiling: boolean;
}

export const GRAVITY = 0.62;
export const MAX_FALL = 13;

export function createBody(x: number, y: number, w: number, h: number): Body {
  return { x, y, w, h, vx: 0, vy: 0, onGround: false, hitWall: false, hitCeiling: false };
}

/** Protíná obdélník v pixelech nějakou pevnou dlaždici? */
export function hitsSolid(
  grid: TileGrid, x: number, y: number, w: number, h: number,
): boolean {
  const left = Math.floor(x / grid.tile);
  const right = Math.floor((x + w - 0.001) / grid.tile);
  const top = Math.floor(y / grid.tile);
  const bottom = Math.floor((y + h - 0.001) / grid.tile);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (grid.solid(tx, ty)) return true;
    }
  }
  return false;
}

/**
 * Posune tělo o jeho rychlost a vyřeší kolize s mapou.
 *
 * Posun po ose se dělí na kroky nejvýš o velikosti dlaždice, aby rychlé
 * tělo dlaždicí neproletělo — bez toho by střela nebo padající postava
 * při vyšší rychlosti prošla podlahou.
 */
export function stepBody(
  body: Body, grid: TileGrid,
  options: { gravity?: number; maxFall?: number } = {},
): void {
  const gravity = options.gravity ?? GRAVITY;
  const maxFall = options.maxFall ?? MAX_FALL;

  body.vy = Math.min(maxFall, body.vy + gravity);
  body.onGround = false;
  body.hitWall = false;
  body.hitCeiling = false;

  moveAxis(body, grid, body.vx, 0);
  moveAxis(body, grid, 0, body.vy);
}

/** Posune tělo po jedné ose s dělením na kroky menší než dlaždice. */
function moveAxis(body: Body, grid: TileGrid, dx: number, dy: number): void {
  const distance = Math.abs(dx || dy);
  if (distance === 0) return;
  const steps = Math.max(1, Math.ceil(distance / grid.tile));
  const stepX = dx / steps;
  const stepY = dy / steps;

  for (let i = 0; i < steps; i++) {
    const nextX = body.x + stepX;
    const nextY = body.y + stepY;
    if (!hitsSolid(grid, nextX, nextY, body.w, body.h)) {
      body.x = nextX;
      body.y = nextY;
      continue;
    }

    if (stepX !== 0) {
      // Dorovnat k hraně dlaždice, ať postava nestojí kousek od stěny.
      body.x = stepX > 0
        ? Math.floor((body.x + body.w + stepX) / grid.tile) * grid.tile - body.w
        : Math.floor((body.x + stepX) / grid.tile + 1) * grid.tile;
      body.vx = 0;
      body.hitWall = true;
    } else {
      body.y = stepY > 0
        ? Math.floor((body.y + body.h + stepY) / grid.tile) * grid.tile - body.h
        : Math.floor((body.y + stepY) / grid.tile + 1) * grid.tile;
      if (stepY > 0) body.onGround = true;
      else body.hitCeiling = true;
      body.vy = 0;
    }
    return;
  }
}

/** Stojí tělo na pevné dlaždici, i když se zrovna nehýbe? */
export function standingOn(body: Body, grid: TileGrid): boolean {
  return hitsSolid(grid, body.x, body.y + 1, body.w, body.h);
}

export function overlaps(a: Body, b: Body): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Mapa z řádků textu. Pevné jsou znaky uvedené v `solidChars`;
 * mimo mapu je pevno jen dole, aby postava nepropadla světem, ale mohla
 * vyskočit nad horní okraj.
 */
export function gridFromRows(
  rows: string[], tile: number, solidChars: string,
): TileGrid {
  const width = rows[0]?.length ?? 0;
  const height = rows.length;
  return {
    width,
    height,
    tile,
    solid(tx, ty) {
      if (tx < 0 || tx >= width) return true;
      if (ty < 0) return false;
      if (ty >= height) return true;
      return solidChars.includes(rows[ty]![tx] ?? ' ');
    },
  };
}
