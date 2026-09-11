import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'piskvorky',
  title: { cs: 'Piškvorky', en: 'Five in a Row' },
  tagline: {
    cs: 'Pět v řadě na čtverečkovaném papíře. Plocha se posouvá, jak hra roste.',
    en: 'Five in a row on squared paper. The board pans as the game grows.',
  },
  category: 'spolu',
  tags: ['strategie', 'dva hráči', 'proti počítači', 'papír'],
  modes: [
    { id: 'lehka', name: { cs: 'Proti počítači — lehká', en: 'Computer — easy' }, ranked: false, scoring: 'high', unit: 'points' },
    { id: 'stredni', name: { cs: 'Proti počítači — střední', en: 'Computer — medium' }, ranked: false, scoring: 'high', unit: 'points' },
    { id: 'tezka', name: { cs: 'Proti počítači — těžká', en: 'Computer — hard' }, ranked: false, scoring: 'high', unit: 'points' },
    { id: 'dva-hraci', name: { cs: 'Dva hráči', en: 'Two players' }, ranked: false, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 2, local: true, online: false },
  controls: { keyboard: true, touch: true, gamepad: false, mouse: true },
  aspect: { width: 640, height: 620 },
  orientation: 'any',
  avgSessionMin: 6,
  difficulty: 3,
  rulesVersion: 1,
};
