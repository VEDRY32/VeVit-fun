import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'had',
  title: { cs: 'Had', en: 'Snake' },
  tagline: {
    cs: 'Sbírej jídlo, rosť a nenaraz do sebe. Čím delší, tím těžší.',
    en: 'Eat, grow, and do not bite yourself. The longer you get, the harder it is.',
  },
  category: 'arkady',
  tags: ['rychlost', 'reflexy', 'klasika', 'rekordy', 'bonusy'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'bez-zdi', name: { cs: 'Bez zdí', en: 'No walls' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'bludiste', name: { cs: 'Bludiště', en: 'Maze' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 2, local: true, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: false },
  aspect: { width: 600, height: 600 },
  orientation: 'any',
  avgSessionMin: 3,
  difficulty: 2,
  rulesVersion: 2,
};
