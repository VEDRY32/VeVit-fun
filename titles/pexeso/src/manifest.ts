import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'pexeso',
  title: { cs: 'Pexeso', en: 'Memory' },
  tagline: {
    cs: 'Otáčej karty a hledej dvojice. Sám na čas, nebo proti kamarádovi.',
    en: 'Flip cards and find the pairs. Against the clock or against a friend.',
  },
  category: 'spolu',
  tags: ['paměť', 'pro děti', 'dva hráči', 'klid'],
  modes: [
    { id: 'mala', name: { cs: 'Malá (4×4)', en: 'Small (4×4)' }, ranked: true, scoring: 'low', unit: 'ms' },
    { id: 'stredni', name: { cs: 'Střední (6×6)', en: 'Medium (6×6)' }, ranked: true, scoring: 'low', unit: 'ms' },
    { id: 'velka', name: { cs: 'Velká (8×8)', en: 'Large (8×8)' }, ranked: true, scoring: 'low', unit: 'ms' },
    { id: 'dva-hraci', name: { cs: 'Dva hráči', en: 'Two players' }, ranked: false, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 2, local: true, online: false },
  controls: { keyboard: true, touch: true, gamepad: false, mouse: true },
  aspect: { width: 640, height: 680 },
  orientation: 'any',
  avgSessionMin: 4,
  difficulty: 1,
  rulesVersion: 1,
};
