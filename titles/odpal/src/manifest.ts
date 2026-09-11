import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'odpal',
  title: { cs: 'Odpal', en: 'Deflect' },
  tagline: {
    cs: 'Pálka, míček a úhel odrazu podle místa dopadu. Sám, ve dvou i ve čtyřech.',
    en: 'Paddle, ball, and an angle that depends on where it hits. One to four players.',
  },
  category: 'arkady',
  tags: ['reflexy', 'dva hráči', 'klasika', 'krátká partie'],
  modes: [
    { id: 'lehka', name: { cs: 'Proti počítači — lehká', en: 'Computer — easy' }, ranked: false, scoring: 'high', unit: 'points' },
    { id: 'stredni', name: { cs: 'Proti počítači — střední', en: 'Computer — medium' }, ranked: false, scoring: 'high', unit: 'points' },
    { id: 'tezka', name: { cs: 'Proti počítači — těžká', en: 'Computer — hard' }, ranked: false, scoring: 'high', unit: 'points' },
    { id: 'dva-hraci', name: { cs: 'Dva hráči', en: 'Two players' }, ranked: false, scoring: 'high', unit: 'points' },
    { id: 'ctyri', name: { cs: 'Čtyři ve čtverci', en: 'Four in a square' }, ranked: false, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 4, local: true, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: true },
  aspect: { width: 640, height: 400 },
  orientation: 'landscape',
  avgSessionMin: 4,
  difficulty: 2,
  rulesVersion: 1,
};
