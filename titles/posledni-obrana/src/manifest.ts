import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'posledni-obrana',
  title: { cs: 'Poslední obrana', en: 'Last Stand' },
  tagline: {
    cs: 'Vlny nepřátel proti jedné barikádě. Mezi vlnami si vyber vylepšení.',
    en: 'Waves of enemies against one barricade. Pick an upgrade between waves.',
  },
  category: 'akce',
  tags: ['střílečka', 'vlny', 'vylepšení', 'myš'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: false, mouse: true },
  aspect: { width: 720, height: 480 },
  orientation: 'landscape',
  avgSessionMin: 7,
  difficulty: 3,
  rulesVersion: 1,
};
