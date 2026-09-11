import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'cihlobijec',
  title: { cs: 'Cihlobijec', en: 'Brickbreaker' },
  tagline: {
    cs: 'Odrážej míček pádlem a rozbij všechny cihly. Sbírej vylepšení.',
    en: 'Bounce the ball off your paddle and clear every brick. Catch power-ups.',
  },
  category: 'arkady',
  tags: ['reflexy', 'odrazy', 'vylepšení', 'klasika'],
  modes: [
    { id: 'kampan', name: { cs: 'Kampaň', en: 'Campaign' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'nekonecny', name: { cs: 'Nekonečný', en: 'Endless' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: true },
  aspect: { width: 480, height: 620 },
  orientation: 'portrait',
  avgSessionMin: 6,
  difficulty: 3,
  rulesVersion: 1,
};
