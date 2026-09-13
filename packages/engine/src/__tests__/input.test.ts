// @vitest-environment happy-dom

/**
 * Vstup je jediné místo, kudy se hráč dostane do hry, a zároveň visí na
 * `window` — chyby v něm se proto projeví jako „hra sama něco udělala"
 * nebo „nejde psát do vyhledávání". Tenhle test drží tři hranice, na
 * kterých to v portálu selhalo.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createInput, type InputManager } from '../input/input.js';

function makeTarget(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  // happy-dom nepočítá layout; hra potřebuje nenulový obdélník.
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return el;
}

function pointerEvent(type: string, x: number, y: number): Event {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: 1 });
  return event;
}

describe('createInput', () => {
  let target: HTMLElement;
  let input: InputManager;

  beforeEach(() => {
    document.body.replaceChildren();
    target = makeTarget();
    input = createInput({ target, logicalWidth: 200, logicalHeight: 100 });
  });

  it('bere klávesy pro akce hry', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
    input.sample();
    expect(input.pressed('left')).toBe(true);
    expect(input.held('left')).toBe(true);
  });

  it('nepropadne stisk kratší než jeden krok logiky', () => {
    // Klávesa stisknutá a puštěná mezi dvěma vzorky se dřív ztratila celá:
    // hra pak „občas nereagovala" na rychlé ťuknutí.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }));
    input.sample();
    expect(input.pressed('right')).toBe(true);

    // A trvá právě jeden krok, ne déle.
    input.sample();
    expect(input.held('right')).toBe(false);
    expect(input.released('right')).toBe(true);
  });

  it('stejně ošetří i tlačítko z dotykového overlay', () => {
    input.setVirtual('a', true);
    input.setVirtual('a', false);
    input.sample();
    expect(input.pressed('a')).toBe(true);
  });

  it('nechá klávesy poli formuláře', () => {
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    input.sample();
    expect(input.held('a')).toBe(false);
  });

  it('bere jako tah jen puštění, jehož stisk začal na herní ploše', () => {
    // Kliknutí do překryvu pauzy: `pointerup` dorazí na okno, stisk na
    // ploše ale nikdy nebyl — do hry to patřit nesmí.
    window.dispatchEvent(pointerEvent('pointerup', 40, 20));
    input.sample();
    expect(input.pointer.released).toBe(false);
    expect(input.pointer.down).toBe(false);

    target.dispatchEvent(pointerEvent('pointerdown', 40, 20));
    input.sample();
    expect(input.pointer.pressed).toBe(true);
    window.dispatchEvent(pointerEvent('pointerup', 40, 20));
    input.sample();
    expect(input.pointer.released).toBe(true);
  });

  it('ztráta fokusu pustí držené klávesy i nevyzvednutý stisk', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    target.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    window.dispatchEvent(new Event('blur'));
    input.sample();
    expect(input.held('right')).toBe(false);
    expect(input.pointer.pressed).toBe(false);
    expect(input.pointer.down).toBe(false);
  });

  it('reset zahodí stisk, který přišel mimo běžící smyčku', () => {
    // Přesně stav po pauze: hráč stiskl, smyčka nekrokovala, stisk čeká.
    target.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
    input.reset();
    input.sample();
    expect(input.pointer.pressed).toBe(false);
    expect(input.held('up')).toBe(false);
  });

  it('nezajíždí ukazatel, aby plátno uvnitř dál dostávalo události', () => {
    // Zajetí ukazatele na hostitelském divu přesměruje `pointerup` na div
    // a plátno pod ním o kliknutí přijde — tím přestalo jít ovládat myší
    // půlku katalogu (Sudoku, Hledač min, Čtyři v řadě, Piškvorky, Pasiáns).
    let captured = 0;
    target.setPointerCapture = () => {
      captured += 1;
    };
    const canvas = document.createElement('canvas');
    target.appendChild(canvas);
    let clicks = 0;
    canvas.addEventListener('pointerup', () => {
      clicks += 1;
    });

    canvas.dispatchEvent(pointerEvent('pointerdown', 10, 10));
    canvas.dispatchEvent(pointerEvent('pointerup', 10, 10));

    expect(captured).toBe(0);
    expect(clicks).toBe(1);
  });

  it('destroy odhlásí posluchače', () => {
    input.destroy();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
    input.sample();
    expect(input.held('left')).toBe(false);
  });
});
