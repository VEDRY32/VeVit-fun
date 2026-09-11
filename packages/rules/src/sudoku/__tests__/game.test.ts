import { describe, it, expect } from 'vitest';
import { createSudoku, type SudokuGame } from '../game.js';
import { CELLS } from '../solver.js';

/** Najde první prázdnou buňku. */
function firstEmpty(game: SudokuGame): number {
  for (let index = 0; index < CELLS; index++) {
    if (!game.isGiven(index)) return index;
  }
  throw new Error('Zadání nemá prázdnou buňku.');
}

describe('Sudoku — stav hry', () => {
  it('zadaná čísla jdou poznat a nejdou přepsat', () => {
    const game = createSudoku('zadane', 'lehka');
    const given = [...Array(CELLS).keys()].find((i) => game.isGiven(i))!;
    const before = game.valueAt(given);
    game.select(given);
    expect(game.enter(5)).toBe(false);
    expect(game.valueAt(given)).toBe(before);
  });

  it('zápis čísla do prázdné buňky projde', () => {
    const game = createSudoku('zapis', 'lehka');
    const index = firstEmpty(game);
    game.select(index);
    expect(game.enter(4)).toBe(true);
    expect(game.valueAt(index)).toBe(4);
  });

  it('stejné číslo podruhé buňku vymaže', () => {
    const game = createSudoku('vymaz', 'lehka');
    const index = firstEmpty(game);
    game.select(index);
    game.enter(4);
    game.enter(4);
    expect(game.valueAt(index)).toBe(0);
  });

  it('neplatné číslo se odmítne', () => {
    const game = createSudoku('neplatne', 'lehka');
    game.select(firstEmpty(game));
    expect(game.enter(0)).toBe(false);
    expect(game.enter(10)).toBe(false);
  });
});

describe('Sudoku — poznámky', () => {
  it('v režimu poznámek se číslo přepíná jako poznámka', () => {
    const game = createSudoku('poznamky', 'lehka');
    const index = firstEmpty(game);
    game.select(index);
    game.toggleNoteMode();

    game.enter(3);
    expect(game.state.notes[index]! & (1 << 2)).not.toBe(0);
    expect(game.valueAt(index)).toBe(0);

    game.enter(3);
    expect(game.state.notes[index]! & (1 << 2)).toBe(0);
  });

  it('zapsané číslo zmizí z poznámek sousedů', () => {
    const game = createSudoku('sousede', 'lehka');
    const index = firstEmpty(game);

    // Poznámku s pětkou dáme do všech prázdných buněk.
    game.state.notes.fill(1 << 4);

    game.select(index);
    game.enter(5);

    for (const peer of [...Array(CELLS).keys()].filter((i) => i !== index)) {
      const sharesUnit = Math.floor(peer / 9) === Math.floor(index / 9)
        || peer % 9 === index % 9;
      if (sharesUnit) expect(game.state.notes[peer]! & (1 << 4)).toBe(0);
    }
  });

  it('doplnění poznámek zapíše všechny kandidáty', () => {
    const game = createSudoku('kandidati', 'lehka');
    game.fillNotes();
    const index = firstEmpty(game);
    expect(game.state.notes[index]).toBeGreaterThan(0);
  });
});

describe('Sudoku — krok zpět a vpřed', () => {
  it('krok zpět vrátí předchozí hodnotu', () => {
    const game = createSudoku('zpet', 'lehka');
    const index = firstEmpty(game);
    game.select(index);
    game.enter(7);
    expect(game.undo()).toBe(true);
    expect(game.valueAt(index)).toBe(0);
  });

  it('krok vpřed zápis vrátí', () => {
    const game = createSudoku('vpred', 'lehka');
    const index = firstEmpty(game);
    game.select(index);
    game.enter(7);
    game.undo();
    expect(game.redo()).toBe(true);
    expect(game.valueAt(index)).toBe(7);
  });

  it('nový tah po kroku zpět zahodí větev vpřed', () => {
    const game = createSudoku('vetev', 'lehka');
    const index = firstEmpty(game);
    game.select(index);
    game.enter(7);
    game.undo();
    game.enter(3);
    expect(game.redo()).toBe(false);
    expect(game.valueAt(index)).toBe(3);
  });

  it('bez historie krok zpět ani vpřed nic neudělá', () => {
    const game = createSudoku('prazdna-historie', 'lehka');
    expect(game.undo()).toBe(false);
    expect(game.redo()).toBe(false);
  });
});

describe('Sudoku — konflikty a nápověda', () => {
  it('dvě stejná čísla v řadě se označí jako konflikt', () => {
    const game = createSudoku('konflikt', 'lehka');
    // Najdeme dvě prázdné buňky ve stejném řádku.
    let a = -1;
    let b = -1;
    for (let row = 0; row < 9 && b === -1; row++) {
      const empties = [...Array(9).keys()]
        .map((c) => row * 9 + c)
        .filter((i) => !game.isGiven(i));
      if (empties.length >= 2) {
        a = empties[0]!;
        b = empties[1]!;
      }
    }
    expect(b).toBeGreaterThanOrEqual(0);

    game.select(a);
    game.enter(9);
    game.select(b);
    game.enter(9);

    const conflicts = game.conflicts();
    expect(conflicts.has(a)).toBe(true);
    expect(conflicts.has(b)).toBe(true);
  });

  it('zvýraznění konfliktů jde vypnout', () => {
    const game = createSudoku('bez-konfliktu', 'lehka');
    game.state.showConflicts = false;
    expect(game.conflicts().size).toBe(0);
  });

  it('nápověda navrhne správné číslo a vysvětlí proč', () => {
    const game = createSudoku('napoveda', 'lehka');
    const hint = game.hint();
    expect(hint).not.toBeNull();
    expect(hint!.value).toBe(game.state.solution[hint!.index]);
    expect(hint!.reason.length).toBeGreaterThan(5);
    expect(game.state.hintsUsed).toBe(1);
  });

  it('nápověda nejdřív opraví špatně zapsané číslo', () => {
    const game = createSudoku('oprava', 'lehka');
    const index = firstEmpty(game);
    const correct = game.state.solution[index]!;
    const wrong = correct === 9 ? 1 : correct + 1;

    game.select(index);
    game.enter(wrong);

    const hint = game.hint();
    expect(hint!.index).toBe(index);
    expect(hint!.value).toBe(correct);
    expect(hint!.reason).toMatch(/nemůže/);
  });
});

describe('Sudoku — dokončení', () => {
  it('vyplněné správné řešení hru ukončí', () => {
    const game = createSudoku('hotovo', 'velmi-lehka');
    for (let index = 0; index < CELLS; index++) {
      if (game.isGiven(index)) continue;
      game.select(index);
      game.enter(game.state.solution[index]!);
    }
    expect(game.state.solved).toBe(true);
  });

  it('čas běží, dokud není hotovo', () => {
    const game = createSudoku('cas', 'lehka');
    for (let i = 0; i < 60; i++) game.tick();
    expect(game.elapsedMs()).toBe(1000);

    game.state.solved = true;
    for (let i = 0; i < 60; i++) game.tick();
    expect(game.elapsedMs()).toBe(1000);
  });

  it('stejný seed dá stejné zadání', () => {
    const a = createSudoku('stejne', 'stredni');
    const b = createSudoku('stejne', 'stredni');
    expect([...a.state.puzzle]).toEqual([...b.state.puzzle]);
  });
});
