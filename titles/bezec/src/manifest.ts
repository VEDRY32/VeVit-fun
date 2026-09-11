import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'bezec',
  title: { cs: 'Běžec', en: 'Runner' },
  tagline: {
    cs: 'Liška běží, ty skáčeš a krčíš se. Funguje i bez připojení.',
    en: 'The fox runs, you jump and duck. Works offline too.',
  },
  category: 'arkady',
  tags: ['jedno tlačítko', 'reflexy', 'offline', 'krátká partie'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: true },
  aspect: { width: 640, height: 240 },
  orientation: 'any',
  avgSessionMin: 2,
  difficulty: 2,
  rulesVersion: 1,
};
