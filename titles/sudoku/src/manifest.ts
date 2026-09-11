import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'sudoku',
  title: { cs: 'Sudoku', en: 'Sudoku' },
  tagline: {
    cs: 'Doplň čísla tak, aby se v řadě, sloupci ani čtverci neopakovala.',
    en: 'Fill in the numbers so none repeats in a row, column or box.',
  },
  category: 'logika',
  tags: ['čísla', 'odvozování', 'klid', 'denní výzva'],
  modes: [
    { id: 'velmi-lehka', name: { cs: 'Velmi lehká', en: 'Very easy' }, ranked: true, scoring: 'low', unit: 'ms' },
    { id: 'lehka', name: { cs: 'Lehká', en: 'Easy' }, ranked: true, scoring: 'low', unit: 'ms' },
    { id: 'stredni', name: { cs: 'Střední', en: 'Medium' }, ranked: true, scoring: 'low', unit: 'ms' },
    { id: 'tezka', name: { cs: 'Těžká', en: 'Hard' }, ranked: true, scoring: 'low', unit: 'ms' },
    { id: 'velmi-tezka', name: { cs: 'Velmi těžká', en: 'Very hard' }, ranked: true, scoring: 'low', unit: 'ms' },
    { id: 'denni', name: { cs: 'Denní sudoku', en: 'Daily sudoku' }, ranked: true, scoring: 'low', unit: 'ms' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: false, mouse: true },
  aspect: { width: 560, height: 720 },
  orientation: 'portrait',
  avgSessionMin: 12,
  difficulty: 3,
  rulesVersion: 1,
};
