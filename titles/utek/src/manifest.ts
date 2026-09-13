import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'utek',
  title: { cs: 'Útěk', en: 'Getaway' },
  tagline: {
    cs: 'Tři pruhy, překážky a stín v zádech. Každý náraz ho pustí blíž.',
    en: 'Three lanes, obstacles and a shadow behind you. Every hit lets it closer.',
  },
  category: 'arkady',
  tags: ['nekonečný běh', 'reflexy', 'rekordy', 'krátká partie'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: false },
  aspect: { width: 720, height: 360 },
  orientation: 'landscape',
  avgSessionMin: 3,
  difficulty: 2,
  rulesVersion: 1,
};
