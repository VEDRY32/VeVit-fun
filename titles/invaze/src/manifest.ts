import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'invaze',
  title: { cs: 'Invaze', en: 'Invasion' },
  tagline: {
    cs: 'Formace nepřátel sestupuje a zrychluje. Hlídej si přehřátí zbraně.',
    en: 'The enemy formation descends and speeds up. Watch your weapon heat.',
  },
  category: 'arkady',
  tags: ['střílečka', 'vlny', 'klasika', 'reflexy'],
  modes: [
    { id: 'snadna', name: { cs: 'Snadná', en: 'Easy' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'stredni', name: { cs: 'Střední', en: 'Normal' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'tezka', name: { cs: 'Těžká', en: 'Hard' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: false },
  aspect: { width: 520, height: 620 },
  orientation: 'portrait',
  avgSessionMin: 5,
  difficulty: 3,
  rulesVersion: 2,
};
