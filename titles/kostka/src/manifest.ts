import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'kostka',
  title: { cs: 'Kostka', en: 'The Block' },
  tagline: {
    cs: 'Převaluj kvádr po dlaždicích a shoď ho do díry. Naležato se nepropadne.',
    en: 'Roll the block across the tiles and drop it into the hole. Lying flat it will not fall.',
  },
  category: 'logika',
  tags: ['hlavolam', 'tahová', 'úrovně', 'klid'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'low', unit: 'moves' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: true },
  aspect: { width: 640, height: 520 },
  orientation: 'any',
  avgSessionMin: 6,
  difficulty: 3,
  rulesVersion: 1,
};
