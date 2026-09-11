import { describe, it, expect } from 'vitest';
import { createHledacMin, DIFFICULTIES, type HledacGame } from '../game.js';

const countMines = (game: HledacGame): number => game.state.mines.filter(Boolean).length;

/** Najde pole, které po prvním odkrytí zůstalo skryté. */
function hiddenCell(game: HledacGame): { x: number; y: number; index: number } {
  const index = game.state.cells.findIndex((c) => c === 'hidden');
  if (index === -1) throw new Error('Všechna pole jsou odkrytá — test potřebuje jiné zadání.');
  return { x: index % game.config.width, y: Math.floor(index / game.config.width), index };
}

describe('Hledač min — rozmístění', () => {
  it('obtížnosti mají zadané rozměry a počty min', () => {
    expect(DIFFICULTIES.zacatecnik).toEqual({ width: 9, height: 9, mines: 10 });
    expect(DIFFICULTIES.pokrocily).toEqual({ width: 16, height: 16, mines: 40 });
    expect(DIFFICULTIES.expert).toEqual({ width: 30, height: 16, mines: 99 });
  });

  it('miny se rozmístí až po prvním kliknutí', () => {
    const game = createHledacMin('start');
    expect(game.state.started).toBe(false);
    expect(countMines(game)).toBe(0);
    game.reveal(4, 4);
    expect(game.state.started).toBe(true);
    expect(countMines(game)).toBe(10);
  });

  it('první kliknutí je bezpečné včetně celého okolí', () => {
    // Sto různých seedů — kdyby byla pojistka děravá, projeví se to.
    for (let i = 0; i < 100; i++) {
      const game = createHledacMin(`bezpecne-${i}`);
      game.reveal(4, 4);
      expect(game.state.over).toBe(false);
      const first = game.index(4, 4);
      expect(game.state.mines[first]).toBe(false);
      for (const n of game.neighbours(first)) {
        expect(game.state.mines[n]).toBe(false);
      }
      // Bezpečné okolí navíc znamená, že první pole má vždy nulu.
      expect(game.state.counts[first]).toBe(0);
    }
  });

  it('stejný seed dá stejné rozmístění', () => {
    const a = createHledacMin('stejne');
    const b = createHledacMin('stejne');
    a.reveal(3, 3);
    b.reveal(3, 3);
    expect(a.state.mines).toEqual(b.state.mines);
  });

  it('počet min v okolí sedí s rozmístěním', () => {
    const game = createHledacMin('pocty', { width: 12, height: 12, mines: 20 });
    game.reveal(5, 5);
    for (let i = 0; i < 12 * 12; i++) {
      if (game.state.mines[i]) {
        expect(game.state.counts[i]).toBe(-1);
      } else {
        expect(game.state.counts[i]).toBe(game.neighbours(i).filter((n) => game.state.mines[n]).length);
      }
    }
  });

  it('nikdy nezadá víc min, než kolik zbývá bezpečných polí', () => {
    const game = createHledacMin('moc-min', { width: 5, height: 5, mines: 999 });
    game.reveal(2, 2);
    expect(countMines(game)).toBe(25 - 9);
  });
});

describe('Hledač min — odkrývání', () => {
  it('prázdné pole se rozlije do okolí', () => {
    const game = createHledacMin('rozliti', { width: 16, height: 16, mines: 10 });
    game.reveal(8, 8);
    expect(game.state.revealedCount).toBeGreaterThan(1);
  });

  it('vlajka brání odkrytí', () => {
    const game = createHledacMin('vlajka');
    game.reveal(4, 4);
    const target = hiddenCell(game);
    game.toggleFlag(target.x, target.y);
    const before = game.state.revealedCount;
    game.reveal(target.x, target.y);
    expect(game.state.revealedCount).toBe(before);
    expect(game.state.cells[target.index]).toBe('flagged');
  });

  it('vlajka se přepíná tam a zpět', () => {
    const game = createHledacMin('prepinani');
    game.reveal(4, 4);
    const target = hiddenCell(game);
    game.toggleFlag(target.x, target.y);
    expect(game.state.cells[target.index]).toBe('flagged');
    expect(game.state.flagsUsed).toBe(1);
    game.toggleFlag(target.x, target.y);
    expect(game.state.cells[target.index]).toBe('hidden');
    expect(game.state.flagsUsed).toBe(0);
  });

  it('otazník je třetí stav, když je zapnutý', () => {
    const game = createHledacMin('otaznik', { questionMarks: true });
    game.reveal(4, 4);
    const target = hiddenCell(game);
    game.toggleFlag(target.x, target.y);
    game.toggleFlag(target.x, target.y);
    expect(game.state.cells[target.index]).toBe('question');
    game.toggleFlag(target.x, target.y);
    expect(game.state.cells[target.index]).toBe('hidden');
  });

  it('odkrytí miny hru ukončí a označí místo výbuchu', () => {
    const game = createHledacMin('vybuch', { width: 10, height: 10, mines: 15 });
    game.reveal(5, 5);
    const mineIndex = game.state.mines.findIndex(Boolean);
    game.reveal(mineIndex % 10, Math.floor(mineIndex / 10));
    expect(game.state.over).toBe(true);
    expect(game.state.won).toBe(false);
    expect(game.state.explodedAt).toBe(mineIndex);
  });

  it('odkrytí všech bezpečných polí je výhra', () => {
    const game = createHledacMin('vyhra', { width: 8, height: 8, mines: 5 });
    game.reveal(4, 4);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (!game.state.mines[game.index(x, y)]) game.reveal(x, y);
      }
    }
    expect(game.state.won).toBe(true);
    expect(game.state.over).toBe(true);
  });

  it('po konci hry už nejde nic odkrýt', () => {
    const game = createHledacMin('po-konci', { width: 10, height: 10, mines: 15 });
    game.reveal(5, 5);
    const target = hiddenCell(game);
    const mineIndex = game.state.mines.findIndex(Boolean);
    game.reveal(mineIndex % 10, Math.floor(mineIndex / 10));
    const revealed = game.state.revealedCount;
    game.reveal(target.x, target.y);
    expect(game.state.revealedCount).toBe(revealed);
  });
});

describe('Hledač min — hromadné odkrytí', () => {
  it('odkryje okolí, když počet vlajek sedí', () => {
    const game = createHledacMin('chord', { width: 10, height: 10, mines: 12 });
    game.reveal(5, 5);
    // Najdi odkryté číslo a označ všechny miny v jeho okolí.
    const numbered = game.state.cells.findIndex(
      (c, i) => c === 'revealed' && game.state.counts[i]! > 0,
    );
    if (numbered === -1) return;
    for (const n of game.neighbours(numbered)) {
      if (game.state.mines[n]) game.toggleFlag(n % 10, Math.floor(n / 10));
    }
    const before = game.state.revealedCount;
    game.chord(numbered % 10, Math.floor(numbered / 10));
    expect(game.state.revealedCount).toBeGreaterThanOrEqual(before);
    expect(game.state.over).toBe(false);
  });

  it('nic neudělá, když počet vlajek nesedí', () => {
    const game = createHledacMin('chord-nesedi', { width: 10, height: 10, mines: 12 });
    game.reveal(5, 5);
    const numbered = game.state.cells.findIndex(
      (c, i) => c === 'revealed' && game.state.counts[i]! > 0,
    );
    if (numbered === -1) return;
    const before = game.state.revealedCount;
    game.chord(numbered % 10, Math.floor(numbered / 10));
    expect(game.state.revealedCount).toBe(before);
  });
});

describe('Hledač min — režim bez hádání', () => {
  it('vygeneruje pole, které jde dohrát odvozením', () => {
    // Menší pole s rozumnou hustotou; generátor má 200 pokusů.
    let solvableCount = 0;
    for (let i = 0; i < 20; i++) {
      const game = createHledacMin(`bez-hadani-${i}`, {
        width: 9, height: 9, mines: 10, noGuessing: true,
      });
      game.reveal(4, 4);
      // Zkus hru dohrát čistě odvozením: opakuj hromadné odkrytí a vlajkování.
      for (let round = 0; round < 200 && !game.state.over; round++) {
        let progress = false;
        for (let idx = 0; idx < 81; idx++) {
          if (game.state.cells[idx] !== 'revealed') continue;
          const count = game.state.counts[idx]!;
          if (count <= 0) continue;
          const around = game.neighbours(idx);
          const hidden = around.filter((n) => game.state.cells[n] === 'hidden');
          const flags = around.filter((n) => game.state.cells[n] === 'flagged').length;
          if (hidden.length > 0 && count - flags === hidden.length) {
            for (const n of hidden) game.toggleFlag(n % 9, Math.floor(n / 9));
            progress = true;
          } else if (hidden.length > 0 && count === flags) {
            game.chord(idx % 9, Math.floor(idx / 9));
            progress = true;
          }
        }
        if (!progress) break;
      }
      if (game.state.won) solvableCount++;
    }
    // Generátor nemusí uspět pokaždé, ale drtivá většina musí být čistá.
    expect(solvableCount).toBeGreaterThanOrEqual(18);
  });
});

describe('Hledač min — čas', () => {
  it('čas běží až od prvního odkrytí', () => {
    const game = createHledacMin('cas');
    for (let i = 0; i < 60; i++) game.tick();
    expect(game.elapsedMs()).toBe(0);
    game.reveal(4, 4);
    for (let i = 0; i < 60; i++) game.tick();
    expect(game.elapsedMs()).toBe(1000);
  });
});
