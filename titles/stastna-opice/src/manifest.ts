import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'stastna-opice',
  title: { cs: 'Šťastná opice', en: 'Happy Monkey' },
  tagline: {
    cs: 'Klikej, sbírej a používej. Čtyři scény a jedna opice, která chce být šťastná.',
    en: 'Click, collect and combine. Four scenes and one monkey that wants to be happy.',
  },
  category: 'logika',
  tags: ['klikačka', 'hlavolam', 'klid', 'scény'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: false, mouse: true },
  aspect: { width: 640, height: 514 },
  orientation: 'landscape',
  avgSessionMin: 8,
  difficulty: 2,
  rulesVersion: 1,
};
