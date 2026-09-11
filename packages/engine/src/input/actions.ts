/** Abstraktní herní akce. Hra nikdy nečte konkrétní klávesy přímo. */
export const ACTIONS = [
  'left', 'right', 'up', 'down',
  'a', 'b', 'x', 'y',
  'l', 'r',
  'start', 'select',
  'pointer',
] as const;

export type Action = (typeof ACTIONS)[number];

export type Keymap = Record<Action, string[]>;

/** Výchozí mapování. Hráč si ho může přemapovat v nastavení. */
export const DEFAULT_KEYMAP: Keymap = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  a: ['Space', 'KeyK'],
  b: ['KeyZ', 'KeyJ'],
  x: ['KeyX', 'KeyL'],
  y: ['KeyC', 'ShiftLeft'],
  l: ['KeyQ'],
  r: ['KeyE'],
  start: ['Enter'],
  select: ['Escape'],
  pointer: [],
};

/** Druhá sada pro lokální hru dvou hráčů na jedné klávesnici. */
export const PLAYER2_KEYMAP: Keymap = {
  left: ['KeyA'],
  right: ['KeyD'],
  up: ['KeyW'],
  down: ['KeyS'],
  a: ['KeyG'],
  b: ['KeyF'],
  x: ['KeyH'],
  y: ['KeyT'],
  l: ['KeyR'],
  r: ['KeyY'],
  start: ['Tab'],
  select: [],
  pointer: [],
};

/** Standardní rozložení Gamepad API → akce. */
export const GAMEPAD_BUTTONS: Record<number, Action> = {
  0: 'a',
  1: 'b',
  2: 'x',
  3: 'y',
  4: 'l',
  5: 'r',
  9: 'start',
  8: 'select',
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};
