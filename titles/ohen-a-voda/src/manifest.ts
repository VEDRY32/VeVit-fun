import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'ohen-a-voda',
  title: { cs: 'Oheň a Voda', en: 'Fire and Water' },
  tagline: {
    cs: 'Dva hráči na jedné klávesnici. Každý projde jen svojí kaluží a sám to nedá.',
    en: 'Two players on one keyboard. Each crosses only their own pool — and neither can finish alone.',
  },
  category: 'spolu',
  tags: ['pro dva', 'plošinovka', 'hlavolam', 'spolupráce'],
  modes: [
    { id: 'klasik', name: { cs: 'Klasik', en: 'Classic' }, ranked: true, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 2, local: true, online: false },
  controls: { keyboard: true, touch: false, gamepad: false, mouse: false },
  aspect: { width: 624, height: 338 },
  orientation: 'landscape',
  avgSessionMin: 8,
  difficulty: 2,
  rulesVersion: 1,
};
