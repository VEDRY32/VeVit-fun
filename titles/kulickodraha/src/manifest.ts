import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'kulickodraha',
  title: { cs: 'Kuličkodráha', en: 'Skyball' },
  tagline: {
    cs: 'Kulička letí po nebeské dráze plné mezer. Uhýbej, skákej, přežij co nejdéle.',
    en: 'A ball races along a sky track full of gaps. Dodge, jump, survive as long as you can.',
  },
  category: 'arkady',
  tags: ['nekonečný běh', 'reflexy', 'rekordy', 'krátká partie'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'denni', name: { cs: 'Denní výzva', en: 'Daily challenge' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: false },
  aspect: { width: 640, height: 400 },
  orientation: 'landscape',
  avgSessionMin: 2,
  difficulty: 3,
  rulesVersion: 1,
};
