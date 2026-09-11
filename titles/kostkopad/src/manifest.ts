import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'kostkopad',
  title: { cs: 'Kostkopád', en: 'Blockfall' },
  tagline: {
    cs: 'Klasická hra s padajícími kostkami. Skládej řady, dokud stíháš.',
    en: 'The classic falling-blocks game. Clear rows while you can.',
  },
  category: 'logika',
  tags: ['skládání', 'rychlost', 'rekordy', 'denní výzva'],
  modes: [
    { id: 'maraton', name: { cs: 'Maraton', en: 'Marathon' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'sprint40', name: { cs: 'Sprint 40 řad', en: '40-line sprint' }, ranked: true, scoring: 'low', unit: 'ms' },
    { id: 'ultra', name: { cs: 'Ultra (2 minuty)', en: 'Ultra (2 minutes)' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'denni', name: { cs: 'Denní výzva', en: 'Daily challenge' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 4, local: false, online: true },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: false },
  aspect: { width: 640, height: 720 },
  orientation: 'any',
  avgSessionMin: 6,
  difficulty: 3,
  rulesVersion: 1,
};
