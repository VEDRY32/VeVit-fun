/**
 * Design tokeny portálu.
 *
 * Myšlenka: portál je tmavá herna téměř bez barvy, ve které svítí jen hry.
 * Rozhraní drží smaragdovou primární a oranžovou sekundární barvu, zbytek
 * je neutrální šedá škála na téměř černém pozadí.
 *
 * Barevné hodnoty se tady nepíšou — přebírají se z `paleta` v enginu,
 * aby hry i rozhraní kreslily ze stejného zdroje (viz render/palette.ts).
 * CSS zrcadlo je `styles/tokens.css`; shodu hlídá `__tests__/tokeny.test.ts`.
 */

import type { GameCategory } from '@vevit-games/engine';
import { paleta, paletaKategorii } from '@vevit-games/engine';

export const colors = paleta;

export const categoryColors: Record<GameCategory, string> = paletaKategorii;

export const categoryNames: Record<GameCategory, { cs: string; en: string }> = {
  logika: { cs: 'Logika a slova', en: 'Logic and words' },
  arkady: { cs: 'Arkády', en: 'Arcade' },
  akce: { cs: 'Akce a strategie', en: 'Action and strategy' },
  spolu: { cs: 'Hraj s ostatními', en: 'Play together' },
  karty: { cs: 'Karty a klid', en: 'Cards and calm' },
  original: { cs: 'Originály VeVit', en: 'VeVit Originals' },
};

export const fonts = {
  /** Jediná rodina portálu; řezy 400–800. */
  text: "'Inter', 'Segoe UI', system-ui, sans-serif",
} as const;

export const fontWeights = {
  normalni: 400,
  stredni: 500,
  polotucne: 600,
  tucne: 700,
  vyrazne: 800,
} as const;

export const fontSizes = {
  sm: '0.875rem',
  md: '1rem',
  lg: '1.25rem',
  xl: '1.5rem',
  xxl: '2rem',
  hero: '3.5rem',
} as const;

export const radii = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
  /** Sémantické aliasy používané komponentami. */
  tile: '12px',
  button: '8px',
  field: '8px',
} as const;

export const space = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
  sekce: '64px',
} as const;

export const effects = {
  primaryGlow: '0 0 24px rgba(16, 185, 129, 0.12)',
  secondaryGlow: '0 0 24px rgba(249, 115, 22, 0.12)',
} as const;

export const components = {
  button: {
    height: '40px',
    padding: `0 ${space.md}`,
    radius: radii.button,
    primary: { bg: colors.zelena, hover: colors.zelenaTmava, active: colors.zelenaTmavsi },
    secondary: { bg: colors.oranzova, hover: colors.oranzovaTmava, active: colors.oranzovaTmavsi },
    disabled: { bg: colors.pultSvetly, color: colors.neaktivni },
  },
  input: {
    height: '40px',
    padding: '0 12px',
    radius: radii.field,
    bg: colors.pult,
    border: colors.linka,
    focusBorder: colors.zelena,
    disabledOpacity: 0.5,
  },
  card: {
    bg: colors.pult,
    border: colors.linka,
    radius: radii.lg,
    padding: space.md,
    hover: { bg: colors.pultSvetly, border: colors.linkaSvetla },
  },
} as const;
