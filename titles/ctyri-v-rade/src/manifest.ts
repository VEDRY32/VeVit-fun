import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'ctyri-v-rade',
  title: { cs: 'Čtyři v řadě', en: 'Four in a Row' },
  tagline: {
    cs: 'Házej žetony do sloupců a dostaň čtyři za sebou dřív než soupeř.',
    en: 'Drop tokens into columns and line up four before your opponent.',
  },
  category: 'spolu',
  tags: ['strategie', 'dva hráči', 'proti počítači', 'krátká partie'],
  modes: [
    { id: 'lehka', name: { cs: 'Proti počítači — lehká', en: 'Versus computer — easy' }, ranked: false, scoring: 'high', unit: 'points' },
    { id: 'stredni', name: { cs: 'Proti počítači — střední', en: 'Versus computer — medium' }, ranked: false, scoring: 'high', unit: 'points' },
    { id: 'tezka', name: { cs: 'Proti počítači — těžká', en: 'Versus computer — hard' }, ranked: false, scoring: 'high', unit: 'points' },
    { id: 'dva-hraci', name: { cs: 'Dva hráči', en: 'Two players' }, ranked: false, scoring: 'high', unit: 'points' },
  ],
  players: { min: 1, max: 2, local: true, online: false },
  controls: { keyboard: true, touch: true, gamepad: true, mouse: true },
  aspect: { width: 620, height: 620 },
  orientation: 'any',
  avgSessionMin: 4,
  difficulty: 2,
  rulesVersion: 1,
};
