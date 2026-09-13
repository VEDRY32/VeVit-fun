import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'mavnik',
  title: { cs: 'Mávník', en: 'Flapper' },
  tagline: {
    cs: 'Jedno tlačítko, papírový drak a mezery mezi stožáry. Jak daleko doletíš?',
    en: 'One button, a paper kite and gaps between poles. How far can you get?',
  },
  category: 'arkady',
  tags: ['jedno tlačítko', 'reflexy', 'denní výzva', 'krátká partie'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'denni', name: { cs: 'Denní výzva', en: 'Daily challenge' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: true },
  aspect: { width: 400, height: 600 },
  orientation: 'portrait',
  avgSessionMin: 2,
  difficulty: 3,
  rulesVersion: 2,
};
