import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'hladovec',
  title: { cs: 'Hladovec', en: 'Muncher' },
  tagline: {
    cs: 'Vysbírej bludiště a vyhni se Prachošům. Velká tečka je na chvíli otočí.',
    en: 'Clear the maze and dodge the Dustlings. A big dot turns the tables.',
  },
  category: 'arkady',
  tags: ['bludiště', 'sbírání', 'klasika', 'reflexy'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: false },
  aspect: { width: 504, height: 576 },
  orientation: 'any',
  avgSessionMin: 6,
  difficulty: 3,
  rulesVersion: 2,
};
