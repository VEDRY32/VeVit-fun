import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'zdvojka',
  title: { cs: 'Zdvojka', en: 'Doubler' },
  tagline: {
    cs: 'Posouvej čísla a slučuj stejná. Dojdeš až ke dvěma tisícům?',
    en: 'Slide numbers and merge matching ones. Can you reach two thousand?',
  },
  category: 'logika',
  tags: ['čísla', 'tahová', 'klid', 'denní výzva'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'pohodovy', name: { cs: 'Pohodový', en: 'Relaxed' }, ranked: false, scoring: 'high', unit: 'points' },
    { id: 'denni', name: { cs: 'Denní seed', en: 'Daily seed' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'casovka', name: { cs: 'Časovka 3 minuty', en: '3-minute rush' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: false },
  aspect: { width: 480, height: 560 },
  orientation: 'any',
  avgSessionMin: 5,
  difficulty: 2,
  rulesVersion: 1,
};
