import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'poulicni-bitka',
  title: { cs: 'Pouliční bitka', en: 'Street Brawl' },
  tagline: {
    cs: 'Ulice má šířku i hloubku. Uhýbej, pouštěj kombo a přežij vlnu za vlnou.',
    en: 'The street has width and depth. Dodge, chain your combo and survive wave after wave.',
  },
  category: 'akce',
  tags: ['mlátička', 'vlny', 'kombo', 'reflexy'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: false },
  aspect: { width: 720, height: 400 },
  orientation: 'landscape',
  avgSessionMin: 6,
  difficulty: 3,
  rulesVersion: 1,
};
