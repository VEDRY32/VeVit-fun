/**
 * Sudoku.
 *
 * Číselník je pod mřížkou, aby šel ovládat palcem. Zvýraznění stejných
 * čísel a řádku/sloupce/čtverce vybrané buňky je hlavní pomůcka, která
 * sudoku na dotyku dělá snesitelným.
 */

import {
  createLoop, createSurface, roundRect, centerText, withAlpha,
  type GameContext, type GameInstance, type GameModule, type Keymap,
} from '@vevit-games/engine';
import {
  createSudoku, SIZE, CELLS, rowOf, colOf, boxOf,
  type Difficulty,
} from '@vevit-games/rules/sudoku';
import { manifest } from './manifest.js';

const VIEW_W = 560;
const VIEW_H = 720;
const HEADER = 54;
const BOARD = 520;
const BOARD_X = (VIEW_W - BOARD) / 2;
const BOARD_Y = HEADER + 8;
const CELL = BOARD / SIZE;
const PAD_Y = BOARD_Y + BOARD + 24;
const PAD_H = 96;

export { manifest };

export const keymap: Partial<Keymap> = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  a: ['Backspace', 'Delete'],
  b: ['KeyN'],
  x: ['KeyH'],
  y: ['KeyZ'],
};

export const controlHints = [
  { action: 'pointer', label: 'Výběr buňky a číslo', keys: 'klik / tap' },
  { action: 'left', label: 'Pohyb po mřížce', keys: '← ↑ → ↓' },
  { action: 'b', label: 'Režim poznámek', keys: 'N' },
  { action: 'x', label: 'Nápověda', keys: 'H' },
  { action: 'y', label: 'Krok zpět', keys: 'Z' },
];

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = '#0F1C3F';
  c.fillRect(0, 0, width, height);

  const size = Math.min(width, height) * 0.9;
  const cell = size / SIZE;
  const originX = (width - size) / 2;
  const originY = (height - size) / 2;

  c.fillStyle = '#172A57';
  roundRect(c, originX, originY, size, size, 8);
  c.fill();

  // Mřížka se silnějšími čarami po trojicích.
  for (let i = 0; i <= SIZE; i++) {
    const thick = i % 3 === 0;
    c.strokeStyle = thick ? 'rgba(238,242,255,0.42)' : 'rgba(238,242,255,0.14)';
    c.lineWidth = thick ? 2 : 1;
    c.beginPath();
    c.moveTo(originX + i * cell, originY);
    c.lineTo(originX + i * cell, originY + size);
    c.moveTo(originX, originY + i * cell);
    c.lineTo(originX + size, originY + i * cell);
    c.stroke();
  }

  // Čísla se postupně doplňují a zase mizí.
  const filled = Math.floor((Math.sin(t * 0.5) + 1) / 2 * 40) + 12;
  for (let index = 0; index < CELLS; index++) {
    const noise = Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1;
    if (noise * 81 > filled) continue;
    const value = (index * 7 + Math.floor(index / 9) * 3) % 9 + 1;
    centerText(
      c, String(value),
      originX + (index % SIZE + 0.5) * cell,
      originY + (Math.floor(index / SIZE) + 0.5) * cell,
      `500 ${Math.round(cell * 0.55)}px system-ui, sans-serif`,
      noise < 0.35 ? '#EEF2FF' : '#8FA6FF',
    );
  }
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });
  const { input } = ctx;

  const difficulty = (ctx.mode === 'denni' ? 'stredni' : ctx.mode) as Difficulty;
  let game = createSudoku(ctx.seed, difficulty);
  let finished = false;
  /** Buňka zvýrazněná nápovědou. */
  let hintCell = -1;
  let hintTicks = 0;
  let hintText = '';

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.audio.play('win');
    const durationMs = game.elapsedMs();
    void ctx.scores.submit({
      runId: null, mode: ctx.mode, score: durationMs, durationMs,
      stats: { napovedy: game.state.hintsUsed, tahy: game.state.moves },
    });
    ctx.emit({
      type: 'win', score: durationMs, durationMs,
      stats: { napovedy: game.state.hintsUsed },
    });
  };

  const cellAt = (px: number, py: number): number => {
    const col = Math.floor((px - BOARD_X) / CELL);
    const row = Math.floor((py - BOARD_Y) / CELL);
    if (col < 0 || row < 0 || col >= SIZE || row >= SIZE) return -1;
    return row * SIZE + col;
  };

  /** Tlačítka číselníku a ovládání pod mřížkou. */
  const padButtons = (): { label: string; x: number; y: number; w: number; h: number; action: string }[] => {
    const out: { label: string; x: number; y: number; w: number; h: number; action: string }[] = [];
    const gap = 6;
    const w = (BOARD - gap * 8) / 9;
    for (let i = 1; i <= 9; i++) {
      out.push({
        label: String(i),
        x: BOARD_X + (i - 1) * (w + gap),
        y: PAD_Y,
        w, h: 52,
        action: `cislo-${i}`,
      });
    }
    const tools = [
      { label: game.state.noteMode ? 'Poznámky ✓' : 'Poznámky', action: 'poznamky' },
      { label: 'Smazat', action: 'smazat' },
      { label: 'Zpět', action: 'zpet' },
      { label: 'Nápověda', action: 'napoveda' },
    ];
    const toolW = (BOARD - gap * 3) / 4;
    tools.forEach((tool, i) => {
      out.push({
        label: tool.label,
        x: BOARD_X + i * (toolW + gap),
        y: PAD_Y + 60,
        w: toolW, h: 36,
        action: tool.action,
      });
    });
    return out;
  };

  const useHint = (): void => {
    const hint = game.hint();
    if (!hint) {
      ctx.audio.play('error');
      return;
    }
    game.select(hint.index);
    const wasNoteMode = game.state.noteMode;
    game.state.noteMode = false;
    // Nápověda číslo rovnou zapíše — jinak by hráč musel hádat, co se myslí.
    if (game.valueAt(hint.index) !== hint.value) game.enter(hint.value);
    game.state.noteMode = wasNoteMode;

    hintCell = hint.index;
    hintTicks = 240;
    hintText = hint.reason;
    ctx.audio.play('pickup');
  };

  const runAction = (action: string): void => {
    if (action.startsWith('cislo-')) {
      game.enter(Number(action.slice(6)));
      ctx.audio.play('tick');
      return;
    }
    switch (action) {
      case 'poznamky':
        game.toggleNoteMode();
        ctx.audio.play('click');
        break;
      case 'smazat':
        game.clear();
        ctx.audio.play('tick');
        break;
      case 'zpet':
        game.undo();
        ctx.audio.play('tick');
        break;
      case 'napoveda':
        useHint();
        break;
      default:
        break;
    }
  };

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    // Hlavička
    c.textBaseline = 'middle';
    c.font = '500 14px system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillStyle = ctx.theme.textMuted;
    const modeName = manifest.modes.find((m) => m.id === ctx.mode)?.name.cs ?? '';
    c.fillText(modeName, 20, HEADER / 2);
    c.textAlign = 'right';
    c.fillStyle = ctx.theme.text;
    c.font = '600 18px system-ui, sans-serif';
    const seconds = Math.floor(game.elapsedMs() / 1000);
    c.fillText(
      `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
      VIEW_W - 20, HEADER / 2,
    );

    const selected = game.state.selected;
    const selectedValue = game.valueAt(selected);
    const conflicts = game.conflicts();

    // Pozadí buněk: nejdřív zvýraznění, pak čísla.
    for (let index = 0; index < CELLS; index++) {
      const x = BOARD_X + colOf(index) * CELL;
      const y = BOARD_Y + rowOf(index) * CELL;

      const sameUnit = rowOf(index) === rowOf(selected)
        || colOf(index) === colOf(selected)
        || boxOf(index) === boxOf(selected);
      const sameValue = selectedValue !== 0 && game.valueAt(index) === selectedValue;

      let fill = ctx.theme.surface;
      if (index === selected) fill = withAlpha(ctx.theme.accent, 0.32);
      else if (sameValue) fill = withAlpha(ctx.theme.accent, 0.16);
      else if (sameUnit) fill = withAlpha(ctx.theme.text, 0.06);

      c.fillStyle = fill;
      c.fillRect(x, y, CELL, CELL);

      if (conflicts.has(index)) {
        c.fillStyle = withAlpha('#FF5F6D', 0.28);
        c.fillRect(x, y, CELL, CELL);
      }
      if (index === hintCell && hintTicks > 0) {
        c.strokeStyle = '#2FD27A';
        c.lineWidth = 2.5;
        c.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3);
      }
    }

    // Mřížka
    for (let i = 0; i <= SIZE; i++) {
      const thick = i % 3 === 0;
      c.strokeStyle = thick ? withAlpha(ctx.theme.text, 0.5) : withAlpha(ctx.theme.text, 0.16);
      c.lineWidth = thick ? 2.5 : 1;
      c.beginPath();
      c.moveTo(BOARD_X + i * CELL, BOARD_Y);
      c.lineTo(BOARD_X + i * CELL, BOARD_Y + BOARD);
      c.moveTo(BOARD_X, BOARD_Y + i * CELL);
      c.lineTo(BOARD_X + BOARD, BOARD_Y + i * CELL);
      c.stroke();
    }

    // Čísla a poznámky
    for (let index = 0; index < CELLS; index++) {
      const x = BOARD_X + colOf(index) * CELL;
      const y = BOARD_Y + rowOf(index) * CELL;
      const value = game.valueAt(index);

      if (value !== 0) {
        const given = game.isGiven(index);
        const wrong = conflicts.has(index);
        centerText(
          c, String(value), x + CELL / 2, y + CELL / 2,
          `${given ? '700' : '500'} ${Math.round(CELL * 0.56)}px system-ui, sans-serif`,
          wrong ? '#FF5F6D' : given ? ctx.theme.text : ctx.theme.accent,
        );
        continue;
      }

      const notes = game.state.notes[index]!;
      if (notes === 0) continue;
      for (let n = 1; n <= 9; n++) {
        if ((notes & (1 << (n - 1))) === 0) continue;
        const nx = x + ((n - 1) % 3 + 0.5) * (CELL / 3);
        const ny = y + (Math.floor((n - 1) / 3) + 0.5) * (CELL / 3);
        centerText(c, String(n), nx, ny,
          `500 ${Math.round(CELL * 0.2)}px system-ui, sans-serif`,
          withAlpha(ctx.theme.textMuted, 0.85));
      }
    }

    // Číselník a nástroje
    for (const button of padButtons()) {
      const isNumber = button.action.startsWith('cislo-');
      // Číslo, které už je na desce devětkrát, se ztlumí.
      let used = 0;
      if (isNumber) {
        const value = Number(button.action.slice(6));
        for (let i = 0; i < CELLS; i++) if (game.valueAt(i) === value) used++;
      }
      const done = isNumber && used >= 9;

      c.fillStyle = button.action === 'poznamky' && game.state.noteMode
        ? withAlpha(ctx.theme.accent, 0.3)
        : ctx.theme.surface;
      roundRect(c, button.x, button.y, button.w, button.h, 8);
      c.fill();
      c.strokeStyle = withAlpha(ctx.theme.text, 0.12);
      c.lineWidth = 1;
      c.stroke();

      centerText(
        c, button.label, button.x + button.w / 2, button.y + button.h / 2,
        `${isNumber ? '600' : '500'} ${isNumber ? 22 : 13}px system-ui, sans-serif`,
        done ? withAlpha(ctx.theme.textMuted, 0.4) : ctx.theme.text,
      );
    }

    // Vysvětlení nápovědy pod číselníkem.
    if (hintTicks > 0 && hintText) {
      centerText(c, hintText, VIEW_W / 2, PAD_Y + PAD_H + 22,
        '500 13px system-ui, sans-serif', '#2FD27A');
    }

    if (game.state.solved) {
      c.fillStyle = withAlpha(ctx.theme.background, 0.86);
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      centerText(c, 'Vyřešeno', VIEW_W / 2, VIEW_H / 2 - 12,
        '600 34px system-ui, sans-serif', ctx.theme.accent);
      centerText(
        c,
        `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
        + (game.state.hintsUsed > 0 ? ` · ${game.state.hintsUsed}× nápověda` : ''),
        VIEW_W / 2, VIEW_H / 2 + 24,
        '500 15px system-ui, sans-serif', ctx.theme.textMuted,
      );
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (game.state.solved) return;
    const local = surface.toLogical(e.clientX, e.clientY);

    const cell = cellAt(local.x, local.y);
    if (cell >= 0) {
      game.select(cell);
      ctx.audio.play('tick');
      return;
    }

    for (const button of padButtons()) {
      if (local.x >= button.x && local.x <= button.x + button.w
        && local.y >= button.y && local.y <= button.y + button.h) {
        runAction(button.action);
        return;
      }
    }
  };
  surface.canvas.addEventListener('pointerup', onPointerUp);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (game.state.solved) return;
    // Číslice ovládáme přímo: engine je do akcí nemapuje.
    const digit = Number(e.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
      e.preventDefault();
      game.enter(digit);
      ctx.audio.play('tick');
    }
  };
  window.addEventListener('keydown', onKeyDown);

  const loop = createLoop(
    {
      update() {
        input.sample();
        game.tick();
        if (hintTicks > 0) hintTicks--;

        const selected = game.state.selected;
        if (input.repeated('left')) game.select(selected - (colOf(selected) > 0 ? 1 : 0));
        if (input.repeated('right')) game.select(selected + (colOf(selected) < SIZE - 1 ? 1 : 0));
        if (input.repeated('up')) game.select(selected - (rowOf(selected) > 0 ? SIZE : 0));
        if (input.repeated('down')) game.select(selected + (rowOf(selected) < SIZE - 1 ? SIZE : 0));

        if (input.pressed('a')) runAction('smazat');
        if (input.pressed('b')) runAction('poznamky');
        if (input.pressed('x')) runAction('napoveda');
        if (input.pressed('y')) runAction('zpet');

        if (game.state.solved) finish();
      },
      render() {
        surface.begin();
        draw();
      },
    },
    { onAutoPause: () => ctx.emit({ type: 'paused' }) },
  );

  loop.start();
  ctx.emit({ type: 'ready' });
  ctx.emit({ type: 'started' });

  return {
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    restart() {
      game = createSudoku(ctx.seed, difficulty);
      finished = false;
      hintCell = -1;
      hintTicks = 0;
      loop.resume();
      ctx.emit({ type: 'started' });
    },
    destroy() {
      loop.stop();
      surface.canvas.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      surface.destroy();
    },
    getSave: () => ({
      entries: [...game.state.entries],
      notes: [...game.state.notes],
      ticks: game.state.ticks,
    }),
    loadSave(data) {
      const save = data as { entries?: number[]; notes?: number[]; ticks?: number } | null;
      if (!save?.entries || save.entries.length !== CELLS) return false;
      game.state.entries.set(save.entries);
      if (save.notes?.length === CELLS) game.state.notes.set(save.notes);
      game.state.ticks = save.ticks ?? 0;
      return true;
    },
  };
}

/** Číselník leží dole, takže nápověda musí jinam. */
export const hintAnchor = 'vpravo-nahore' as const;

export const module_: GameModule = {
  manifest, mount, renderAttract, keymap, controlHints, hintAnchor,
};
