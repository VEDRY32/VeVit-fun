/**
 * Design tokeny portálu.
 *
 * Myšlenka: portál je tichá tmavomodrá herna, ve které svítí jen hry.
 * Rozhraní zůstává klidné, barvu dodávají kategorie a jejich dlaždice.
 */

import type { GameCategory } from '@vevit-games/engine';

export const colors = {
  noc: '#0F1C3F',
  pult: '#172A57',
  linka: '#2A3F73',
  text: '#EEF2FF',
  textTlumeny: '#A3B1D6',
  zelena: '#2FD27A',
} as const;

export const categoryColors: Record<GameCategory, string> = {
  logika: '#8FA6FF',
  arkady: '#FFB224',
  akce: '#FF5F6D',
  spolu: '#35E0CF',
  karty: '#E9D8A6',
  original: colors.zelena,
};

export const categoryNames: Record<GameCategory, { cs: string; en: string }> = {
  logika: { cs: 'Logika a slova', en: 'Logic and words' },
  arkady: { cs: 'Arkády', en: 'Arcade' },
  akce: { cs: 'Akce a strategie', en: 'Action and strategy' },
  spolu: { cs: 'Hraj s ostatními', en: 'Play together' },
  karty: { cs: 'Karty a klid', en: 'Cards and calm' },
  original: { cs: 'Originály VeVit', en: 'VeVit Originals' },
};

/** Typografická stupnice s poměrem 1,25. */
export const fontSizes = {
  xs: '0.8rem',
  sm: '1rem',
  md: '1.25rem',
  lg: '1.5625rem',
  xl: '1.9375rem',
  xxl: '2.4375rem',
} as const;

export const radii = {
  /** Dlaždice hry — herní kazeta se zkoseným rohem. */
  tile: '14px',
  button: '10px',
  field: '8px',
} as const;

export const space = {
  xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '40px', xxl: '64px',
} as const;
