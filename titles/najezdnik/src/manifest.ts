import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'najezdnik',
  title: { cs: 'Nájezdník', en: 'Raider' },
  tagline: {
    cs: 'Běž, skákej a střílej si cestu k východu. Náboje ani život nejsou zadarmo.',
    en: 'Run, jump and shoot your way to the exit. Ammo and health are not free.',
  },
  category: 'akce',
  tags: ['plošinovka', 'střílečka', 'úrovně', 'reflexy'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: false },
  aspect: { width: 640, height: 300 },
  orientation: 'landscape',
  avgSessionMin: 7,
  difficulty: 4,
  rulesVersion: 1,
};
