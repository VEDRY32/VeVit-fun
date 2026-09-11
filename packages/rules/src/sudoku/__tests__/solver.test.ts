import { describe, it, expect } from 'vitest';
import { createRng } from '@vevit-games/engine/core';
import {
  generateSolution, generatePuzzle, hasUniqueSolution, countSolutions,
  isValidPlacement, estimateDifficulty, nextStep, peersOf,
  SIZE, CELLS, UNITS, DIFFICULTY_CAP, TECHNIQUE_ORDER,
  type Grid, type Difficulty,
} from '../solver.js';

/** Je mřížka platné vyplněné sudoku? */
function isCompleteAndValid(grid: Grid): boolean {
  if (grid.some((value) => value === 0)) return false;
  for (const unit of UNITS) {
    const values = unit.map((index) => grid[index]!);
    if (new Set(values).size !== SIZE) return false;
  }
  return true;
}

describe('základy mřížky', () => {
  it('každá buňka má 20 sousedů', () => {
    for (let index = 0; index < CELLS; index++) {
      expect(peersOf(index)).toHaveLength(20);
    }
  });

  it('jednotek je 27 a každá má devět buněk', () => {
    expect(UNITS).toHaveLength(27);
    for (const unit of UNITS) expect(unit).toHaveLength(SIZE);
  });

  it('soused se sebou samým není', () => {
    for (let index = 0; index < CELLS; index++) {
      expect(peersOf(index)).not.toContain(index);
    }
  });
});

describe('generateSolution', () => {
  it('vytvoří platné vyplněné sudoku', () => {
    for (let i = 0; i < 5; i++) {
      expect(isCompleteAndValid(generateSolution(createRng(`reseni-${i}`)))).toBe(true);
    }
  });

  it('stejný seed dá stejné řešení', () => {
    expect([...generateSolution(createRng('x'))]).toEqual([...generateSolution(createRng('x'))]);
  });

  it('různý seed dá jiné řešení', () => {
    expect([...generateSolution(createRng('a'))]).not.toEqual([...generateSolution(createRng('b'))]);
  });
});

describe('countSolutions', () => {
  it('vyplněné platné sudoku má jedno řešení', () => {
    expect(countSolutions(generateSolution(createRng('jedno')))).toBe(1);
  });

  it('prázdná mřížka má řešení mnoho', () => {
    expect(countSolutions(new Int8Array(CELLS), 2)).toBe(2);
  });

  it('rozporuplné zadání nemá řešení', () => {
    const grid = new Int8Array(CELLS);
    grid[0] = 5;
    grid[1] = 5; // dvakrát pětka v jedné řadě
    expect(countSolutions(grid, 2)).toBe(0);
  });
});

describe('isValidPlacement', () => {
  it('zakáže stejné číslo v řádku, sloupci i boxu', () => {
    const grid = new Int8Array(CELLS);
    grid[0] = 7;
    expect(isValidPlacement(grid, 1, 7)).toBe(false);   // stejný řádek
    expect(isValidPlacement(grid, 9, 7)).toBe(false);   // stejný sloupec
    expect(isValidPlacement(grid, 10, 7)).toBe(false);  // stejný box
    expect(isValidPlacement(grid, 40, 7)).toBe(true);   // jinde
  });
});

describe('generatePuzzle', () => {
  /**
   * Zadání s víc řešeními je nefér: hráč může vyplnit správně a hra mu
   * řekne, že je to špatně. Tohle je nejdůležitější vlastnost generátoru.
   */
  it('každé vygenerované zadání má právě jedno řešení', () => {
    const levels: Difficulty[] = ['velmi-lehka', 'lehka', 'stredni', 'tezka', 'velmi-tezka'];
    for (const difficulty of levels) {
      for (let i = 0; i < 6; i++) {
        const { puzzle } = generatePuzzle(createRng(`${difficulty}-${i}`), difficulty);
        expect(hasUniqueSolution(puzzle), `${difficulty} #${i}`).toBe(true);
      }
    }
  });

  it('zadání sedí se svým řešením', () => {
    const { puzzle, solution } = generatePuzzle(createRng('sed'), 'stredni');
    expect(isCompleteAndValid(solution)).toBe(true);
    for (let index = 0; index < CELLS; index++) {
      if (puzzle[index] !== 0) expect(puzzle[index]).toBe(solution[index]);
    }
  });

  it('lehčí obtížnost nechává víc čísel než těžší', () => {
    const easy = generatePuzzle(createRng('lehka-pocet'), 'velmi-lehka').givens;
    const hard = generatePuzzle(createRng('tezka-pocet'), 'velmi-tezka').givens;
    expect(easy).toBeGreaterThan(hard);
  });

  it('zadání je středově symetrické nebo skoro', () => {
    const { puzzle } = generatePuzzle(createRng('symetrie'), 'stredni');
    let asymmetric = 0;
    for (let index = 0; index < CELLS; index++) {
      const mirror = CELLS - 1 - index;
      if ((puzzle[index] !== 0) !== (puzzle[mirror] !== 0)) asymmetric++;
    }
    // Odebírání se občas nepovede symetricky, když by vznikla nejednoznačnost.
    expect(asymmetric).toBeLessThan(CELLS / 3);
  });

  it('stejný seed dá stejné zadání', () => {
    const a = generatePuzzle(createRng('stejne'), 'stredni');
    const b = generatePuzzle(createRng('stejne'), 'stredni');
    expect([...a.puzzle]).toEqual([...b.puzzle]);
  });

  it('nejlehčí obtížnost jde dořešit nejjednodušší technikou', () => {
    for (let i = 0; i < 4; i++) {
      const { puzzle } = generatePuzzle(createRng(`velmi-lehka-${i}`), 'velmi-lehka');
      const technique = estimateDifficulty(puzzle);
      expect(technique).not.toBeNull();
      // Nejlehčí zadání nesmí vyžadovat víc než skryté jedničky.
      expect(TECHNIQUE_ORDER.indexOf(technique!))
        .toBeLessThanOrEqual(TECHNIQUE_ORDER.indexOf('hidden-single'));
    }
  });

  it('obtížnost je zapsaná a má definovaný strop techniky', () => {
    const result = generatePuzzle(createRng('strop'), 'tezka');
    expect(result.difficulty).toBe('tezka');
    expect(DIFFICULTY_CAP.tezka).toBeTruthy();
  });
});

describe('nextStep', () => {
  it('najde buňku s jediným kandidátem', () => {
    const solution = generateSolution(createRng('krok'));
    const puzzle = Int8Array.from(solution);
    puzzle[40] = 0;
    const step = nextStep(puzzle);
    expect(step?.index).toBe(40);
    expect(step?.value).toBe(solution[40]);
    expect(step?.technique).toBe('single');
    expect(step?.reason.length).toBeGreaterThan(5);
  });

  it('na vyřešené mřížce nic nenajde', () => {
    expect(nextStep(generateSolution(createRng('hotovo')))).toBeNull();
  });

  it('navrhne vždy správné číslo', () => {
    const { puzzle, solution } = generatePuzzle(createRng('spravne'), 'lehka');
    const grid = Int8Array.from(puzzle);
    for (let i = 0; i < 20; i++) {
      const step = nextStep(grid);
      if (!step) break;
      expect(step.value).toBe(solution[step.index]);
      grid[step.index] = step.value;
    }
  });
});
