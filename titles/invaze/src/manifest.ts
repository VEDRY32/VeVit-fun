import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'invaze',
  title: { cs: 'Invaze', en: 'Invasion' },
  tagline: {
    cs: 'Formace nepřátel sestupuje a zrychluje. Kryty ti vydrží jen chvíli.',
    en: 'The enemy formation descends and speeds up. Your shields will not last.',
  },
  category: 'arkady',
  tags: ['střílečka', 'vlny', 'klasika', 'reflexy'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: false },
  aspect: { width: 520, height: 620 },
  orientation: 'portrait',
  avgSessionMin: 5,
  difficulty: 3,
  rulesVersion: 1,
};
