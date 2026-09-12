import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'hledac-min',
  title: { cs: 'Hledač min', en: 'Mine Finder' },
  tagline: {
    cs: 'Odkrývej pole a podle čísel odvoď, kde jsou miny. První klik je vždy bezpečný.',
    en: 'Uncover tiles and deduce where the mines are. The first click is always safe.',
  },
  category: 'logika',
  tags: ['odvozování', 'klid', 'rekordy', 'bez hádání'],
  modes: [
    { id: 'zacatecnik', name: { cs: 'Začátečník', en: 'Beginner' }, ranked: true, scoring: 'low', unit: 'ms' },
    { id: 'pokrocily', name: { cs: 'Pokročilý', en: 'Intermediate' }, ranked: true, scoring: 'low', unit: 'ms' },
    { id: 'expert', name: { cs: 'Expert', en: 'Expert' }, ranked: true, scoring: 'low', unit: 'ms' },
    { id: 'bez-hadani', name: { cs: 'Bez hádání', en: 'No guessing' }, ranked: true, scoring: 'low', unit: 'ms' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: false, mouse: true },
  aspect: { width: 620, height: 640 },
  orientation: 'any',
  avgSessionMin: 4,
  difficulty: 3,
  rulesVersion: 2,
};
