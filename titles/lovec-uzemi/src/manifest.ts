import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'lovec-uzemi',
  title: { cs: 'Lovec území', en: 'Land Grab' },
  tagline: {
    cs: 'Obkresluj volnou plochu a zabírej ji. Do vlastní stopy ale nešlápni.',
    en: 'Outline the open space and claim it. Just do not step on your own trail.',
  },
  category: 'arkady',
  tags: ['zabírání plochy', 'reflexy', 'úrovně', 'rekordy'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: false },
  aspect: { width: 640, height: 496 },
  orientation: 'landscape',
  avgSessionMin: 5,
  difficulty: 3,
  rulesVersion: 1,
};
