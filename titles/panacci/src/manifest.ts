import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'panacci',
  title: { cs: 'Panáčci', en: 'Stickfolk' },
  tagline: {
    cs: 'Kupuj kopáče, mečníky, lučištníky a obrněnce. Sraz soupeřovu základnu dřív než on tvoji.',
    en: 'Buy miners, swordsmen, archers and tanks. Bring down the enemy base before they bring down yours.',
  },
  category: 'akce',
  tags: ['strategie', 'jednotky', 'obtížnosti', 'ekonomika'],
  modes: [
    { id: 'snadna', name: { cs: 'Snadná', en: 'Easy' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'stredni', name: { cs: 'Střední', en: 'Normal' }, ranked: true, scoring: 'high', unit: 'points' },
    { id: 'tezka', name: { cs: 'Těžká', en: 'Hard' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: false, mouse: true },
  aspect: { width: 900, height: 360 },
  orientation: 'landscape',
  avgSessionMin: 8,
  difficulty: 4,
  rulesVersion: 1,
};
