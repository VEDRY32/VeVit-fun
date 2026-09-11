import type { GameManifest } from '@vevit-games/engine';

export const manifest: GameManifest = {
  slug: 'petipismenka',
  title: { cs: 'Pětipísmenka', en: 'Five Letters' },
  tagline: {
    cs: 'Uhodni pětipísmenné slovo na šest pokusů. Každý den jedno nové pro všechny.',
    en: 'Guess the five-letter word in six tries. One new word a day for everyone.',
  },
  category: 'logika',
  tags: ['slova', 'denní výzva', 'klid', 'série'],
  modes: [
    { id: 'denni', name: { cs: 'Denní', en: 'Daily' }, ranked: true, scoring: 'low', unit: 'moves' },
    { id: 'nekonecny', name: { cs: 'Nekonečný', en: 'Endless' }, ranked: false, scoring: 'low', unit: 'moves' },
    { id: 'tezky', name: { cs: 'Těžký režim', en: 'Hard mode' }, ranked: false, scoring: 'low', unit: 'moves' },
  ],
  players: { min: 1, max: 1, local: false, online: false },
  controls: { keyboard: true, touch: true, gamepad: false, mouse: true },
  aspect: { width: 520, height: 760 },
  orientation: 'portrait',
  avgSessionMin: 4,
  difficulty: 2,
  rulesVersion: 1,
};
