import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'pasiansy',
  title: { cs: 'Pasiánsy', en: 'Solitaires' },
  tagline: {
    cs: 'Tři klasické pasiánsy v jedné hře. Neomezené vrácení tahu a nápověda.',
    en: 'Three classic solitaires in one game. Unlimited undo and hints.',
  },
  category: 'karty',
  tags: ['karty', 'klid', 'přemýšlení', 'bez časovače'],
  modes: [
    { id: 'klondike1', name: { cs: 'Klasický (líznout 1)', en: 'Classic (draw 1)' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'klondike3', name: { cs: 'Klasický (líznout 3)', en: 'Classic (draw 3)' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'freecell', name: { cs: 'Volná místa', en: 'Free cells' }, ranked: true, scoring: 'low', unit: 'moves' },
    { id: 'pavouk1', name: { cs: 'Pavouk (1 barva)', en: 'Spider (1 suit)' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'pavouk2', name: { cs: 'Pavouk (2 barvy)', en: 'Spider (2 suits)' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'pavouk4', name: { cs: 'Pavouk (4 barvy)', en: 'Spider (4 suits)' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: false, mouse: true },
  aspect: { width: 900, height: 640 },
  orientation: 'landscape',
  avgSessionMin: 8,
  difficulty: 2,
  rulesVersion: 1,
};
