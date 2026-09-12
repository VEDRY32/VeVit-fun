/**
 * Pětipísmenka.
 *
 * Denní režim vyhodnocuje **server** — odpověď se nikdy nedostane do
 * klientského bundlu. Nekonečný a těžký režim běží u hráče nad lokálním
 * slovníkem, kde spoiler nikomu nevadí.
 */

import {
  isEditableTarget,
  paleta, herniPaleta,
  createLoop, createSurface, roundRect, centerText, withAlpha, createRng,
  easing, clamp01,
  type GameContext, type GameInstance, type GameModule,
} from '@vevit-games/engine';
import {
  evaluateGuess, mergeKeyboardState, checkHardMode, shareGrid,
  normalizeWord, WORD_LENGTH, MAX_GUESSES, RESULT_GLYPHS,
  type LetterResult,
} from '@vevit-games/rules/petipismenka';
import { manifest } from './manifest.js';
import { ANSWERS, ALLOWED, answerForDay } from './data/words-cs.js';

const VIEW_W = 520;
const VIEW_H = 760;
const TILE = 62;
const TILE_GAP = 8;
const GRID_TOP = 30;

/** Česká QWERTZ s řadou diakritiky navíc. */
const KEY_ROWS = [
  ['ě', 'š', 'č', 'ř', 'ž', 'ý', 'á', 'í', 'é', 'ů', 'ú'],
  ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['⏎', 'y', 'x', 'c', 'v', 'b', 'n', 'm', 'ď', 'ť', 'ň', '⌫'],
];

const COLORS: Record<LetterResult, string> = {
  correct: paleta.zelena,
  present: herniPaleta.zluta,
  absent: paleta.linka,
};

export { manifest };

export const controlHints = [
  { action: 'pointer', label: 'Psaní', keys: 'klávesnice' },
  { action: 'start', label: 'Odeslat tip', keys: 'Enter' },
];

export function renderAttract(canvas: HTMLCanvasElement, t: number): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const { width, height } = canvas;
  c.fillStyle = paleta.noc;
  c.fillRect(0, 0, width, height);

  const cols = 5;
  const rows = 4;
  const tile = Math.min(width / (cols + 1.6), height / (rows + 1.2));
  const gap = tile * 0.12;
  const gridW = cols * tile + (cols - 1) * gap;
  const originX = (width - gridW) / 2;
  const originY = (height - (rows * tile + (rows - 1) * gap)) / 2;

  // Řádky se postupně otáčejí — stejný pohyb jako ve hře.
  const revealed = (t * 1.4) % (rows + 2);
  const pattern: LetterResult[][] = [
    ['absent', 'present', 'absent', 'absent', 'correct'],
    ['absent', 'correct', 'absent', 'present', 'correct'],
    ['present', 'correct', 'absent', 'correct', 'correct'],
    ['correct', 'correct', 'correct', 'correct', 'correct'],
  ];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const flip = clamp01(revealed - row - col * 0.12);
      const x = originX + col * (tile + gap);
      const y = originY + row * (tile + gap);
      const scaleY = flip < 0.5 ? 1 - flip * 2 : (flip - 0.5) * 2;

      c.save();
      c.translate(x + tile / 2, y + tile / 2);
      c.scale(1, Math.max(0.04, scaleY));
      c.fillStyle = flip > 0.5 ? COLORS[pattern[row]![col]!] : paleta.pult;
      roundRect(c, -tile / 2, -tile / 2, tile, tile, 4);
      c.fill();
      c.restore();
    }
  }
}

interface Row {
  letters: string[];
  results: LetterResult[] | null;
  /** Postup animace otáčení v krocích logiky. */
  flip: number;
  shake: number;
}

export function mount(el: HTMLElement, ctx: GameContext): GameInstance {
  const surface = createSurface(el, {
    logicalWidth: VIEW_W, logicalHeight: VIEW_H, letterbox: ctx.theme.background,
  });

  const mode = ctx.mode;
  const hardMode = mode === 'tezky';
  const isDaily = mode === 'denni';

  // Denní odpověď zná jen server; lokální režimy si vezmou slovo ze seedu.
  const dayNumber = Math.floor(Date.now() / 86_400_000);
  let answer: string | null = isDaily ? null : pickLocalAnswer();

  function pickLocalAnswer(): string {
    if (mode === 'nekonecny' || hardMode) {
      return ANSWERS[createRng(`${ctx.seed}:${Date.now()}`).int(0, ANSWERS.length)]!;
    }
    return answerForDay(dayNumber);
  }

  let rows: Row[] = [];
  let current: string[] = [];
  let keyboard = new Map<string, LetterResult>();
  let finished = false;
  let won = false;
  let message = '';
  let messageTicks = 0;

  const notify = (text: string): void => {
    message = text;
    messageTicks = 140;
  };

  const submitGuess = async (): Promise<void> => {
    if (finished || current.length !== WORD_LENGTH) return;
    const guess = normalizeWord(current.join(''));

    if (!ALLOWED.has(guess) && !ANSWERS.includes(guess)) {
      notify('Tohle slovo neznám.');
      shakeCurrent();
      ctx.audio.play('error');
      return;
    }

    if (hardMode) {
      const violation = checkHardMode(
        guess,
        rows.map((r) => r.letters.join('')),
        rows.map((r) => r.results!).filter(Boolean),
      );
      if (violation) {
        notify(
          violation.kind === 'missing-correct'
            ? `Musíš použít ${violation.letter.toUpperCase()} na ${(violation.position ?? 0) + 1}. místě.`
            : `Musíš použít písmeno ${violation.letter.toUpperCase()}.`,
        );
        shakeCurrent();
        ctx.audio.play('error');
        return;
      }
    }

    let results: LetterResult[];
    if (isDaily) {
      // Server vrátí jen barvy, nikdy odpověď.
      const response = await fetch('/api/daily/petipismenka/guess', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ guess, attempt: rows.length }),
      }).then((r) => (r.ok ? (r.json() as Promise<{ results: LetterResult[]; won: boolean }>) : null))
        .catch(() => null);

      if (!response) {
        notify('Server neodpovídá. Zkus to za chvíli.');
        return;
      }
      results = response.results;
      won = response.won;
    } else {
      results = evaluateGuess(guess, answer!);
      won = results.every((r) => r === 'correct');
    }

    rows.push({ letters: [...current], results, flip: 0, shake: 0 });
    keyboard = mergeKeyboardState(keyboard, guess, results);
    current = [];

    if (won) {
      finished = true;
      ctx.audio.play('win');
      const durationMs = Math.round((tick * 1000) / 60);
      void ctx.scores.submit({
        runId: null, mode, score: rows.length, durationMs,
        stats: { pokusy: rows.length },
      });
      ctx.emit({ type: 'win', score: rows.length, durationMs, stats: { pokusy: rows.length } });
    } else if (rows.length >= MAX_GUESSES) {
      finished = true;
      ctx.audio.play('lose');
      if (answer) notify(`Slovo bylo ${answer.toUpperCase()}.`);
      ctx.emit({
        type: 'gameover',
        score: MAX_GUESSES + 1,
        durationMs: Math.round((tick * 1000) / 60),
      });
    } else {
      ctx.audio.play('click');
    }
  };

  const shakeCurrent = (): void => {
    currentShake = 18;
  };

  let currentShake = 0;
  let tick = 0;

  const typeLetter = (letter: string): void => {
    if (finished || current.length >= WORD_LENGTH) return;
    current.push(letter);
    ctx.audio.play('tick');
  };

  const backspace = (): void => {
    if (finished) return;
    current.pop();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Psaní do vyhledávání v hlavičce není tip do hry.
    if (isEditableTarget(event.target)) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      void submitGuess();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      backspace();
      return;
    }
    const letter = event.key.toLowerCase();
    // Jedno písmeno včetně české diakritiky; číslice a zkratky ignorujeme.
    if ([...letter].length === 1 && /\p{L}/u.test(letter)) {
      event.preventDefault();
      typeLetter(letter);
    }
  };
  window.addEventListener('keydown', onKeyDown);

  // --- Vykreslení ---

  const gridW = WORD_LENGTH * TILE + (WORD_LENGTH - 1) * TILE_GAP;
  const gridX = (VIEW_W - gridW) / 2;
  const keyboardTop = GRID_TOP + MAX_GUESSES * (TILE + TILE_GAP) + 40;

  const keyRects: { key: string; x: number; y: number; w: number; h: number }[] = [];

  const layoutKeyboard = (): void => {
    keyRects.length = 0;
    const keyH = 40;
    const gap = 5;
    KEY_ROWS.forEach((row, rowIndex) => {
      const widths = row.map((k) => (k === '⏎' || k === '⌫' ? 52 : 38));
      const totalW = widths.reduce((a, b) => a + b, 0) + (row.length - 1) * gap;
      let x = (VIEW_W - totalW) / 2;
      const y = keyboardTop + rowIndex * (keyH + gap);
      row.forEach((key, i) => {
        keyRects.push({ key, x, y, w: widths[i]!, h: keyH });
        x += widths[i]! + gap;
      });
    });
  };
  layoutKeyboard();

  const draw = (): void => {
    const c = surface.ctx;
    c.fillStyle = ctx.theme.background;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    for (let row = 0; row < MAX_GUESSES; row++) {
      const data = rows[row];
      const isCurrentRow = row === rows.length && !finished;
      const shakeOffset = isCurrentRow && currentShake > 0
        ? Math.sin(currentShake * 0.9) * Math.min(8, currentShake / 2)
        : 0;

      for (let col = 0; col < WORD_LENGTH; col++) {
        const x = gridX + col * (TILE + TILE_GAP) + shakeOffset;
        const y = GRID_TOP + row * (TILE + TILE_GAP);

        let letter = '';
        let result: LetterResult | null = null;
        let flip = 0;

        if (data) {
          letter = data.letters[col] ?? '';
          result = data.results?.[col] ?? null;
          // Dlaždice se otáčejí jedna po druhé s odstupem 80 ms.
          flip = clamp01((data.flip - col * 4.8) / 9);
        } else if (isCurrentRow) {
          letter = current[col] ?? '';
        }

        const revealed = flip > 0.5;
        const scaleY = ctx.theme.reducedMotion
          ? 1
          : flip === 0 ? 1 : flip < 0.5 ? 1 - flip * 2 : (flip - 0.5) * 2;

        c.save();
        c.translate(x + TILE / 2, y + TILE / 2);
        c.scale(1, Math.max(0.03, scaleY));

        if (revealed || (ctx.theme.reducedMotion && result)) {
          c.fillStyle = COLORS[result ?? 'absent'];
          roundRect(c, -TILE / 2, -TILE / 2, TILE, TILE, 5);
          c.fill();
        } else {
          c.fillStyle = ctx.theme.background;
          roundRect(c, -TILE / 2, -TILE / 2, TILE, TILE, 5);
          c.fill();
          c.strokeStyle = letter
            ? withAlpha(ctx.theme.text, 0.45)
            : withAlpha(ctx.theme.text, 0.16);
          c.lineWidth = 2;
          roundRect(c, -TILE / 2, -TILE / 2, TILE, TILE, 5);
          c.stroke();
        }

        if (letter) {
          centerText(
            c, letter.toUpperCase(), 0, 2,
            '600 30px system-ui, sans-serif',
            revealed && result !== 'absent' ? paleta.noc : ctx.theme.text,
          );
        }

        // Colorblind: symbol v rohu dlaždice navíc k barvě.
        if (ctx.theme.colorblind && revealed && result) {
          c.font = '600 13px system-ui, sans-serif';
          c.fillStyle = result === 'absent' ? ctx.theme.textMuted : paleta.noc;
          c.textAlign = 'right';
          c.textBaseline = 'top';
          c.fillText(RESULT_GLYPHS[result], TILE / 2 - 5, -TILE / 2 + 4);
        }

        c.restore();
      }
    }

    // Klávesnice na obrazovce, obarvená podle toho, co už víme.
    for (const rect of keyRects) {
      const state = keyboard.get(rect.key);
      c.fillStyle = state ? COLORS[state] : ctx.theme.surface;
      roundRect(c, rect.x, rect.y, rect.w, rect.h, 5);
      c.fill();
      centerText(
        c, rect.key.toUpperCase(), rect.x + rect.w / 2, rect.y + rect.h / 2,
        '600 15px system-ui, sans-serif',
        state && state !== 'absent' ? paleta.noc : ctx.theme.text,
      );
    }

    if (messageTicks > 0 && message) {
      const fade = easing.outQuad(clamp01(messageTicks / 30));
      c.globalAlpha = fade;
      c.fillStyle = ctx.theme.surface;
      const width = Math.max(200, message.length * 9);
      roundRect(c, (VIEW_W - width) / 2, GRID_TOP - 2, width, 34, 6);
      c.fill();
      centerText(c, message, VIEW_W / 2, GRID_TOP + 15, '500 14px system-ui, sans-serif', ctx.theme.text);
      c.globalAlpha = 1;
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    const local = surface.toLogical(e.clientX, e.clientY);
    const hit = keyRects.find(
      (r) => local.x >= r.x && local.x <= r.x + r.w && local.y >= r.y && local.y <= r.y + r.h,
    );
    if (!hit) return;
    if (hit.key === '⏎') void submitGuess();
    else if (hit.key === '⌫') backspace();
    else typeLetter(hit.key);
  };
  surface.canvas.addEventListener('pointerup', onPointerUp);

  const loop = createLoop(
    {
      update() {
        tick++;
        if (currentShake > 0) currentShake--;
        if (messageTicks > 0) messageTicks--;
        for (const row of rows) {
          if (row.flip < 40) row.flip++;
        }
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
    destroy() {
      loop.stop();
      window.removeEventListener('keydown', onKeyDown);
      surface.canvas.removeEventListener('pointerup', onPointerUp);
      surface.destroy();
    },
    getSave: () => ({
      rows: rows.map((r) => ({ letters: r.letters, results: r.results })),
      day: dayNumber,
      mode,
    }),
    loadSave(data) {
      const save = data as { rows?: { letters: string[]; results: LetterResult[] }[]; day?: number } | null;
      // Rozehraná denní hra platí jen pro dnešek.
      if (!save?.rows || (isDaily && save.day !== dayNumber)) return false;
      rows = save.rows.map((r) => ({ letters: r.letters, results: r.results, flip: 40, shake: 0 }));
      for (const row of rows) {
        if (row.results) keyboard = mergeKeyboardState(keyboard, row.letters.join(''), row.results);
      }
      return true;
    },
  };
}

/** Sdílený text výsledku — emoji mřížka bez jediného písmene. */
export function buildShareText(results: LetterResult[][], dayNumber: number, won: boolean): string {
  return shareGrid(results, dayNumber, won);
}

export const module_: GameModule = { manifest, mount, renderAttract, controlHints };
