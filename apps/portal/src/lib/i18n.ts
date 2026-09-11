import type { Locale, LocalizedText } from '@vevit-games/engine';

export const LOCALES: Locale[] = ['cs', 'en'];
export const DEFAULT_LOCALE: Locale = 'cs';

/**
 * Texty portálu. Česky se tyká, věty jsou krátké a v sentence case.
 * Tlačítka říkají, co se stane — ne „OK".
 */
const STRINGS: Record<string, LocalizedText> = {
  'app.title': { cs: 'VeVit Games', en: 'VeVit Games' },
  'app.skip': { cs: 'Přeskočit na obsah', en: 'Skip to content' },
  'nav.search': { cs: 'Hledat hry…', en: 'Search games…' },
  'nav.categories': { cs: 'Kategorie', en: 'Categories' },
  'nav.account': { cs: 'Účet', en: 'Account' },
  'nav.settings': { cs: 'Nastavení', en: 'Settings' },
  'nav.allGames': { cs: 'Všechny hry', en: 'All games' },

  'home.heroHint': { cs: 'Stiskni mezerník a hraj', en: 'Press space to play' },
  'home.gameOfDay': { cs: 'Hra dne', en: 'Game of the day' },
  'home.daily': { cs: 'Denní výzvy', en: 'Daily challenges' },
  'home.dailyBody': { cs: 'Každý den tři hry se stejným zadáním pro všechny.', en: 'Three games a day, same setup for everyone.' },
  'home.continue': { cs: 'Pokračuj v hraní', en: 'Continue playing' },
  'home.favorites': { cs: 'Oblíbené', en: 'Favorites' },
  'home.recent': { cs: 'Naposledy hrané', en: 'Recently played' },
  'home.streak': { cs: 'Série', en: 'Streak' },

  'empty.favorites': {
    cs: 'Zatím nemáš oblíbené hry. Přidáš je srdíčkem na dlaždici.',
    en: 'No favorites yet. Add them with the heart on a tile.',
  },
  'empty.recent': {
    cs: 'Ještě jsi nic nehrál. Začni třeba hrou dne.',
    en: 'Nothing played yet. Try the game of the day.',
  },
  'empty.search': {
    cs: 'Nic takového tu není. Zkus jiné slovo nebo projdi kategorie.',
    en: 'Nothing matches. Try another word or browse categories.',
  },

  'game.howToPlay': { cs: 'Jak hrát', en: 'How to play' },
  'game.controls': { cs: 'Ovládání', en: 'Controls' },
  'game.leaderboard': { cs: 'Žebříček', en: 'Leaderboard' },
  'game.similar': { cs: 'Podobné hry', en: 'Similar games' },
  'game.play': { cs: 'Hrát', en: 'Play' },
  'game.mode': { cs: 'Režim', en: 'Mode' },
  'game.loading': { cs: 'Načítám hru…', en: 'Loading game…' },
  'game.rotate': {
    cs: 'Otoč telefon na šířku, hra se tak hraje líp.',
    en: 'Turn your phone sideways — the game plays better that way.',
  },
  'game.gameOver': { cs: 'Konec hry', en: 'Game over' },
  'game.youWon': { cs: 'Dokázal jsi to', en: 'You did it' },

  'error.loadGame': {
    cs: 'Hru se nepodařilo načíst. Zkontroluj připojení a zkus to znovu.',
    en: 'The game could not load. Check your connection and try again.',
  },
  'error.notFound': { cs: 'Takovou hru neznáme.', en: 'We do not know that game.' },
  'error.retry': { cs: 'Zkusit znovu', en: 'Try again' },
  'error.backHome': { cs: 'Zpátky na hry', en: 'Back to games' },

  'settings.title': { cs: 'Nastavení', en: 'Settings' },
  'settings.audio': { cs: 'Zvuk', en: 'Audio' },
  'settings.music': { cs: 'Hudba', en: 'Music' },
  'settings.sfx': { cs: 'Zvukové efekty', en: 'Sound effects' },
  'settings.accessibility': { cs: 'Přístupnost', en: 'Accessibility' },
  'settings.reducedMotion': { cs: 'Omezit pohyb', en: 'Reduce motion' },
  'settings.colorblind': { cs: 'Režim pro barvoslepé', en: 'Colorblind mode' },
  'settings.colorblindHelp': {
    cs: 'Přidá k barvám tvary a symboly.',
    en: 'Adds shapes and symbols on top of colors.',
  },
  'settings.lowQuality': { cs: 'Nízká kvalita grafiky', en: 'Low graphics quality' },
  'settings.lowQualityHelp': {
    cs: 'Vypne částice a efekty. Pomůže starším telefonům.',
    en: 'Turns off particles and effects. Helps older phones.',
  },
  'settings.leftHanded': { cs: 'Ovládání pro leváky', en: 'Left-handed controls' },
  'settings.language': { cs: 'Jazyk', en: 'Language' },
};

export function createI18n(locale: Locale) {
  return {
    locale,
    t(key: string, vars?: Record<string, string | number>): string {
      const entry = STRINGS[key];
      if (!entry) return key;
      let text = entry[locale];
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
      }
      return text;
    },
    pick: (text: LocalizedText): string => text[locale],
  };
}

export type I18n = ReturnType<typeof createI18n>;

export function detectLocale(pathname: string): Locale {
  const segment = pathname.split('/')[1];
  return LOCALES.includes(segment as Locale) ? (segment as Locale) : DEFAULT_LOCALE;
}
