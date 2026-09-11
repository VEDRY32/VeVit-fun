/**
 * Tvary, rotace a wall-kick tabulky pro Kostkopád.
 *
 * Sedm tvarů ze čtyř čtverců, rotační systém se čtyřmi stavy a posuny při
 * rotaci u zdi. Barvy jsou **vlastní paleta** portálu, ne kanonické barvy
 * z originálu (zadání sekce 2, D-012).
 */

export type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

export const PIECE_TYPES: readonly PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

/** 0 = výchozí, 1 = po otočení doprava, 2 = o 180°, 3 = po otočení doleva. */
export type Rotation = 0 | 1 | 2 | 3;

export interface Cell {
  x: number;
  y: number;
}

/** Velikost obalového čtverce, ve kterém tvar rotuje. */
const BOX: Record<PieceType, number> = { I: 4, J: 3, L: 3, O: 4, S: 3, T: 3, Z: 3 };

/** Obsazená pole ve výchozí rotaci; y roste dolů. */
const SPAWN_CELLS: Record<PieceType, Cell[]> = {
  I: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
  J: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  L: [{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  O: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  S: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  T: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  Z: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
};

/** Vlastní paleta — studené i teplé tóny, rozlišitelné i pro barvoslepé. */
export const PIECE_COLORS: Record<PieceType, string> = {
  I: '#4FD1E8',
  J: '#6E8BFF',
  L: '#FF9F45',
  O: '#F4D35E',
  S: '#5FD9A0',
  T: '#C77DFF',
  Z: '#FF6B81',
};

/** Doplňkový symbol do rohu dlaždice pro colorblind režim. */
export const PIECE_GLYPHS: Record<PieceType, string> = {
  I: '│', J: '┐', L: '┌', O: '■', S: 'S', T: '┬', Z: 'Z',
};

function rotateCells(cells: Cell[], box: number, times: number): Cell[] {
  let out = cells;
  for (let i = 0; i < times; i++) {
    // Otočení o 90° doprava uvnitř obalového čtverce.
    out = out.map(({ x, y }) => ({ x: box - 1 - y, y: x }));
  }
  return out;
}

/** Předpočítané tvary pro všechny rotace — za běhu se jen čtou. */
export const PIECE_SHAPES: Record<PieceType, Cell[][]> = Object.fromEntries(
  PIECE_TYPES.map((type) => [
    type,
    // Čtverec se otáčením nemění. Kdyby se rotoval jako ostatní, posunul by se
    // v obalovém čtverci o pole vpravo dolů — a hráč by ho rotací „hýbal".
    type === 'O'
      ? [0, 1, 2, 3].map(() => SPAWN_CELLS.O.map((c) => ({ ...c })))
      : [0, 1, 2, 3].map((r) => rotateCells(SPAWN_CELLS[type], BOX[type], r)),
  ]),
) as Record<PieceType, Cell[][]>;

/**
 * Wall-kick tabulky. Zapsané v konvenci systému rotací, kde **+y míří nahoru**;
 * `applyKick` znaménko obrací, protože v poli y roste dolů.
 */
/** Rotace na sebe samu nemá smysl, takže identické dvojice do tabulky nepatří. */
type KickKey = Exclude<`${Rotation}>${Rotation}`, '0>0' | '1>1' | '2>2' | '3>3'>;
type KickTable = Record<KickKey, readonly (readonly [number, number])[]>;

const KICKS_JLSTZ: KickTable = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  // Otočení o 180° systém rotací nedefinuje. Používáme vlastní rozšíření:
  // nejdřív na místě, pak svislý a vodorovný posun o jedno pole.
  '0>2': [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]],
  '2>0': [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]],
  '1>3': [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]],
  '3>1': [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]],
};

/** Tvar I má vlastní tabulku — je delší a u zdi se chová jinak. */
const KICKS_I: KickTable = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '0>2': [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]],
  '2>0': [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]],
  '1>3': [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]],
  '3>1': [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]],
};

/** Čtvercový tvar se nikdy neposouvá — rotuje na místě. */
const KICKS_O: readonly (readonly [number, number])[] = [[0, 0]];

/**
 * Posuny, které se při rotaci zkoušejí v pořadí. y je už převrácené do
 * souřadnic pole (dolů kladné).
 */
export function kicksFor(type: PieceType, from: Rotation, to: Rotation): readonly (readonly [number, number])[] {
  if (type === 'O') return KICKS_O;
  const table = type === 'I' ? KICKS_I : KICKS_JLSTZ;
  const raw = table[`${from}>${to}` as KickKey];
  // `0 - y` místo `-y`: negace nuly by dala -0, které se v testech i v
  // porovnání chová jinak než 0.
  return raw.map(([x, y]) => [x, 0 - y] as const);
}

export const rotateIndex = (rotation: Rotation, direction: 1 | -1 | 2): Rotation =>
  (((rotation + direction) % 4) + 4) % 4 as Rotation;
