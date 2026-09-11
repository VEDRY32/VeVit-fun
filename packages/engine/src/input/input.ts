/**
 * Sjednocený vstup: klávesnice, gamepad, dotyk a ukazatel → abstraktní akce.
 *
 * Hra se ptá jen na akce. Stav se vzorkuje v kroku logiky (`sample`), takže
 * pořadí událostí je deterministické a jde ho zaznamenat do replaye.
 */

import { ACTIONS, DEFAULT_KEYMAP, GAMEPAD_BUTTONS, type Action, type Keymap } from './actions.js';

export interface PointerState {
  /** Souřadnice v logickém rozlišení hry; `null`, dokud se ukazatel neobjeví. */
  x: number;
  y: number;
  down: boolean;
  /** Stisknuto právě v tomto kroku. */
  pressed: boolean;
  released: boolean;
  inside: boolean;
}

export interface AutoRepeatConfig {
  /** Delayed Auto Shift — prodleva před prvním opakováním (ms). */
  das: number;
  /** Auto Repeat Rate — perioda opakování (ms). 0 = okamžité dojetí. */
  arr: number;
}

export interface InputManager {
  /** Držená akce. */
  held(action: Action): boolean;
  /** Stisknuto právě v tomto kroku logiky. */
  pressed(action: Action): boolean;
  /** Uvolněno právě v tomto kroku logiky. */
  released(action: Action): boolean;
  /**
   * Stisknuto, nebo drženo dost dlouho na auto-opakování.
   * Pro posun figurky v mřížce — DAS/ARR jde nastavit per hra.
   */
  repeated(action: Action, config?: AutoRepeatConfig): boolean;
  /** Jak dlouho je akce držená, v krocích logiky. */
  heldTicks(action: Action): number;
  pointer: PointerState;
  /** Bitová maska všech akcí — kompaktní zápis do replaye. */
  snapshot(): number;
  /** Vnucení stavu při přehrávání replaye na serveru i v klientu. */
  applySnapshot(mask: number): void;
  /** Vzorkování na začátku kroku logiky. Volá smyčka, ne hra. */
  sample(): void;
  setKeymap(map: Partial<Keymap>): void;
  getKeymap(): Keymap;
  /** Virtuální ovládání z dotykového overlay. */
  setVirtual(action: Action, down: boolean): void;
  destroy(): void;
  /** Zaznamenané akce pro nápovědu ControlsHint — co už hráč vyzkoušel. */
  readonly usedActions: ReadonlySet<Action>;
}

export interface InputOptions {
  /** Element, na kterém se poslouchá ukazatel (herní plátno). */
  target: HTMLElement;
  /** Logické rozlišení hry — ukazatel se na něj přepočítá. */
  logicalWidth: number;
  logicalHeight: number;
  keymap?: Partial<Keymap>;
  /** Index gamepadu; `null` = první připojený. */
  gamepadIndex?: number | null;
}

const DEFAULT_REPEAT: AutoRepeatConfig = { das: 170, arr: 50 };

export function createInput(options: InputOptions): InputManager {
  const keymap: Keymap = { ...DEFAULT_KEYMAP };
  for (const [action, keys] of Object.entries(options.keymap ?? {})) {
    if (keys) keymap[action as Action] = keys;
  }

  // Živý stav ze zařízení (mění se kdykoliv) vs. vzorkovaný stav pro logiku.
  const rawDown = new Set<Action>();
  const virtualDown = new Set<Action>();
  const gamepadDown = new Set<Action>();

  let current = 0;
  let previous = 0;
  const heldFor = new Map<Action, number>();
  const repeatTimer = new Map<Action, number>();
  const usedActions = new Set<Action>();

  const pointer: PointerState = { x: 0, y: 0, down: false, pressed: false, released: false, inside: false };
  let pointerDownRaw = false;
  let pointerPressedRaw = false;
  let pointerReleasedRaw = false;

  const bit = (action: Action): number => 1 << ACTIONS.indexOf(action);

  const actionsForKey = (code: string): Action[] =>
    ACTIONS.filter((a) => keymap[a].includes(code));

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const hit = actionsForKey(e.code);
    if (hit.length === 0) return;
    // Šipky a mezerník by jinak scrollovaly stránku pod hrou.
    e.preventDefault();
    for (const a of hit) rawDown.add(a);
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    const hit = actionsForKey(e.code);
    if (hit.length === 0) return;
    e.preventDefault();
    for (const a of hit) rawDown.delete(a);
  };

  // Po přepnutí okna zůstanou klávesy „zaseklé" — při blur je pustíme.
  const onBlur = (): void => {
    rawDown.clear();
    virtualDown.clear();
    gamepadDown.clear();
  };

  const updatePointerPosition = (e: PointerEvent): void => {
    const rect = options.target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    pointer.x = ((e.clientX - rect.left) / rect.width) * options.logicalWidth;
    pointer.y = ((e.clientY - rect.top) / rect.height) * options.logicalHeight;
    pointer.inside =
      pointer.x >= 0 && pointer.y >= 0 &&
      pointer.x <= options.logicalWidth && pointer.y <= options.logicalHeight;
  };

  const onPointerDown = (e: PointerEvent): void => {
    updatePointerPosition(e);
    pointerDownRaw = true;
    pointerPressedRaw = true;
    options.target.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent): void => updatePointerPosition(e);
  const onPointerUp = (e: PointerEvent): void => {
    updatePointerPosition(e);
    pointerDownRaw = false;
    pointerReleasedRaw = true;
    options.target.releasePointerCapture?.(e.pointerId);
  };

  const pollGamepad = (): void => {
    const pads = navigator.getGamepads?.() ?? [];
    const pad =
      options.gamepadIndex != null
        ? pads[options.gamepadIndex]
        : pads.find((p) => p != null);
    gamepadDown.clear();
    if (!pad) return;
    for (const [index, action] of Object.entries(GAMEPAD_BUTTONS)) {
      if (pad.buttons[Number(index)]?.pressed) gamepadDown.add(action);
    }
    // Levá páčka jako kříž, mrtvá zóna 0,35 proti driftu.
    const [ax = 0, ay = 0] = pad.axes;
    if (ax < -0.35) gamepadDown.add('left');
    if (ax > 0.35) gamepadDown.add('right');
    if (ay < -0.35) gamepadDown.add('up');
    if (ay > 0.35) gamepadDown.add('down');
  };

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp, { passive: false });
  window.addEventListener('blur', onBlur);
  options.target.addEventListener('pointerdown', onPointerDown);
  options.target.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  options.target.addEventListener('contextmenu', (e) => e.preventDefault());

  const manager: InputManager = {
    held: (action) => (current & bit(action)) !== 0,
    pressed: (action) => (current & bit(action)) !== 0 && (previous & bit(action)) === 0,
    released: (action) => (current & bit(action)) === 0 && (previous & bit(action)) !== 0,
    heldTicks: (action) => heldFor.get(action) ?? 0,

    repeated(action, config = DEFAULT_REPEAT) {
      if (manager.pressed(action)) {
        repeatTimer.set(action, config.das);
        return true;
      }
      if (!manager.held(action)) {
        repeatTimer.delete(action);
        return false;
      }
      const remaining = (repeatTimer.get(action) ?? config.das) - 1000 / 60;
      if (remaining <= 0) {
        repeatTimer.set(action, config.arr);
        return true;
      }
      repeatTimer.set(action, remaining);
      return false;
    },

    pointer,

    snapshot: () => current,

    applySnapshot(mask) {
      previous = current;
      current = mask;
      for (const action of ACTIONS) {
        if (current & bit(action)) heldFor.set(action, (heldFor.get(action) ?? 0) + 1);
        else heldFor.set(action, 0);
      }
    },

    sample() {
      previous = current;
      let mask = 0;
      for (const action of ACTIONS) {
        const down = rawDown.has(action) || virtualDown.has(action) || gamepadDown.has(action);
        if (down) {
          mask |= bit(action);
          heldFor.set(action, (heldFor.get(action) ?? 0) + 1);
          usedActions.add(action);
        } else {
          heldFor.set(action, 0);
        }
      }
      current = mask;

      pointer.pressed = pointerPressedRaw;
      pointer.released = pointerReleasedRaw;
      pointer.down = pointerDownRaw;
      if (pointerPressedRaw) usedActions.add('pointer');
      pointerPressedRaw = false;
      pointerReleasedRaw = false;

      pollGamepad();
    },

    setKeymap(map) {
      for (const [action, keys] of Object.entries(map)) {
        if (keys) keymap[action as Action] = keys;
      }
    },
    getKeymap: () => ({ ...keymap }),

    setVirtual(action, down) {
      if (down) virtualDown.add(action);
      else virtualDown.delete(action);
    },

    usedActions,

    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      options.target.removeEventListener('pointerdown', onPointerDown);
      options.target.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    },
  };

  return manager;
}

/**
 * Vstup pro headless přehrání replaye na serveru — žádné DOM posluchače,
 * stav se vnucuje ze zaznamenaných masek.
 */
export function createReplayInput(logicalWidth = 0, logicalHeight = 0): InputManager {
  const pointer: PointerState = { x: 0, y: 0, down: false, pressed: false, released: false, inside: false };
  let current = 0;
  let previous = 0;
  const heldFor = new Map<Action, number>();
  const repeatTimer = new Map<Action, number>();
  const keymap: Keymap = { ...DEFAULT_KEYMAP };
  const bit = (action: Action): number => 1 << ACTIONS.indexOf(action);
  void logicalWidth;
  void logicalHeight;

  const manager: InputManager = {
    held: (a) => (current & bit(a)) !== 0,
    pressed: (a) => (current & bit(a)) !== 0 && (previous & bit(a)) === 0,
    released: (a) => (current & bit(a)) === 0 && (previous & bit(a)) !== 0,
    heldTicks: (a) => heldFor.get(a) ?? 0,
    repeated(action, config = DEFAULT_REPEAT) {
      if (manager.pressed(action)) {
        repeatTimer.set(action, config.das);
        return true;
      }
      if (!manager.held(action)) {
        repeatTimer.delete(action);
        return false;
      }
      const remaining = (repeatTimer.get(action) ?? config.das) - 1000 / 60;
      if (remaining <= 0) {
        repeatTimer.set(action, config.arr);
        return true;
      }
      repeatTimer.set(action, remaining);
      return false;
    },
    pointer,
    snapshot: () => current,
    applySnapshot(mask) {
      previous = current;
      current = mask;
      for (const action of ACTIONS) {
        if (current & bit(action)) heldFor.set(action, (heldFor.get(action) ?? 0) + 1);
        else heldFor.set(action, 0);
      }
    },
    sample() {
      // Ve replay režimu stav dodává `applySnapshot`.
    },
    setKeymap() {},
    getKeymap: () => ({ ...keymap }),
    setVirtual() {},
    usedActions: new Set<Action>(),
    destroy() {},
  };
  return manager;
}
