import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'pruchody',
  title: { cs: 'Průchody', en: 'Passages' },
  tagline: {
    cs: 'Polož dvojici průchodů na stěny. Kulička si hybnost vezme s sebou.',
    en: 'Place a pair of passages on the walls. The ball keeps its momentum.',
  },
  category: 'logika',
  tags: ['fyzika', 'hlavolam', 'hybnost', 'myš'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: false, mouse: true },
  aspect: { width: 640, height: 288 },
  orientation: 'landscape',
  avgSessionMin: 6,
  difficulty: 3,
  rulesVersion: 1,
};
