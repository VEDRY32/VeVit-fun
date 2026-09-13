import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'super-skokan',
  title: { cs: 'Super skokan', en: 'Super Hopper' },
  tagline: {
    cs: 'Běž, skákej a dupej po nepřátelích. Čtyři úrovně, tři životy.',
    en: 'Run, jump and stomp your foes. Four levels, three lives.',
  },
  category: 'arkady',
  tags: ['plošinovka', 'skákání', 'úrovně', 'reflexy'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: false },
  aspect: { width: 640, height: 300 },
  orientation: 'landscape',
  avgSessionMin: 6,
  difficulty: 3,
  rulesVersion: 1,
};
