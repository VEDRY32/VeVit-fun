/**
 * Odznaky.
 *
 * Globální (napříč portálem) a per hra. Stav je zatím lokální; až bude
 * profil na serveru, stejná definice poslouží k přepočtu na straně API —
 * proto je vyhodnocení čistá funkce nad statistikami.
 */

export type BadgeScope = 'global' | 'game';

export interface Badge {
  id: string;
  scope: BadgeScope;
  /** U herního odznaku slug hry. */
  game?: string;
  title: string;
  description: string;
  /** Skrytý odznak se před získáním neukazuje celý. */
  hidden?: boolean;
}

export interface PlayerStats {
  /** slug → počet odehraných partií */
  plays: Record<string, number>;
  /** slug → nejlepší skóre */
  best: Record<string, number>;
  /** Aktuální série dní. */
  streak: number;
  /** Počet dokončených denních výzev celkem. */
  dailyDone: number;
  favorites: number;
}

export const EMPTY_STATS: PlayerStats = {
  plays: {}, best: {}, streak: 0, dailyDone: 0, favorites: 0,
};

type Rule = (stats: PlayerStats) => boolean;

const playedDistinct = (stats: PlayerStats): number =>
  Object.values(stats.plays).filter((n) => n > 0).length;

const totalPlays = (stats: PlayerStats): number =>
  Object.values(stats.plays).reduce((sum, n) => sum + n, 0);

interface BadgeDefinition extends Badge {
  rule: Rule;
}

export const BADGES: BadgeDefinition[] = [
  // --- Globální ---
  {
    id: 'prvni-hra', scope: 'global',
    title: 'První partie',
    description: 'Zahrál sis první hru na portálu.',
    rule: (s) => totalPlays(s) >= 1,
  },
  {
    id: 'pet-her', scope: 'global',
    title: 'Rozhlížíš se',
    description: 'Vyzkoušel jsi pět různých her.',
    rule: (s) => playedDistinct(s) >= 5,
  },
  {
    id: 'deset-her', scope: 'global',
    title: 'Znalec katalogu',
    description: 'Vyzkoušel jsi deset různých her.',
    rule: (s) => playedDistinct(s) >= 10,
  },
  {
    id: 'serie-3', scope: 'global',
    title: 'Třídenní série',
    description: 'Tři dny po sobě sis střihl denní výzvu.',
    rule: (s) => s.streak >= 3,
  },
  {
    id: 'serie-7', scope: 'global',
    title: 'Týden v kuse',
    description: 'Sedm dní po sobě bez vynechání.',
    rule: (s) => s.streak >= 7,
  },
  {
    id: 'serie-30', scope: 'global',
    title: 'Měsíc denně',
    description: 'Třicet dní po sobě. To už je zvyk.',
    rule: (s) => s.streak >= 30,
  },
  {
    id: 'vyzvy-25', scope: 'global',
    title: 'Sběratel výzev',
    description: 'Dokončil jsi 25 denních výzev.',
    rule: (s) => s.dailyDone >= 25,
  },
  {
    id: 'oblibene', scope: 'global',
    title: 'Máš svůj vkus',
    description: 'Přidal sis tři hry mezi oblíbené.',
    rule: (s) => s.favorites >= 3,
  },
  {
    id: 'stovka', scope: 'global',
    title: 'Stovka partií',
    description: 'Odehrál jsi sto partií dohromady.',
    rule: (s) => totalPlays(s) >= 100,
  },

  // --- Kostkopád ---
  {
    id: 'kostkopad-1000', scope: 'game', game: 'kostkopad',
    title: 'Tisícovka',
    description: 'Získej v Kostkopádu 1 000 bodů.',
    rule: (s) => (s.best.kostkopad ?? 0) >= 1000,
  },
  {
    id: 'kostkopad-10000', scope: 'game', game: 'kostkopad',
    title: 'Deset tisíc',
    description: 'Získej v Kostkopádu 10 000 bodů.',
    rule: (s) => (s.best.kostkopad ?? 0) >= 10_000,
  },
  {
    id: 'kostkopad-vytrvalec', scope: 'game', game: 'kostkopad',
    title: 'Vytrvalec',
    description: 'Zahraj Kostkopád dvacetkrát.',
    rule: (s) => (s.plays.kostkopad ?? 0) >= 20,
  },

  // --- Pětipísmenka ---
  {
    id: 'petipismenka-prvni', scope: 'game', game: 'petipismenka',
    title: 'Slovo dne',
    description: 'Uhodni denní slovo.',
    rule: (s) => (s.plays.petipismenka ?? 0) >= 1,
  },
  {
    id: 'petipismenka-rychle', scope: 'game', game: 'petipismenka',
    title: 'Na tři pokusy',
    description: 'Uhodni slovo nejvýš na tři pokusy.',
    rule: (s) => {
      const best = s.best.petipismenka;
      return best != null && best > 0 && best <= 3;
    },
  },

  // --- Had ---
  {
    id: 'had-200', scope: 'game', game: 'had',
    title: 'Dlouhán',
    description: 'Získej s Hadem 200 bodů.',
    rule: (s) => (s.best.had ?? 0) >= 200,
  },

  // --- Hledač min ---
  {
    id: 'hledac-bez-hadani', scope: 'game', game: 'hledac-min',
    title: 'Čistá logika',
    description: 'Dohraj Hledač min v režimu bez hádání.',
    rule: (s) => (s.plays['hledac-min'] ?? 0) >= 5,
  },

  // --- Skryté ---
  {
    id: 'nocni-sova', scope: 'global',
    title: 'Noční sova',
    description: 'Hrál jsi mezi půlnocí a čtvrtou ráno.',
    hidden: true,
    rule: () => {
      const hour = Number(
        new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', hour12: false })
          .format(new Date()),
      );
      return hour >= 0 && hour < 4;
    },
  },
];

const KEY = 'vevit.games.badges';

function readUnlocked(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeUnlocked(value: Record<string, number>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Bez úložiště se odznaky neuloží; hra tím netrpí.
  }
}

export interface BadgeState extends Badge {
  unlocked: boolean;
  unlockedAt: number | null;
}

/** Vyhodnotí odznaky a uloží nově získané. Vrací ty, které právě přibyly. */
export function evaluateBadges(stats: PlayerStats): Badge[] {
  const unlocked = readUnlocked();
  const fresh: Badge[] = [];

  for (const badge of BADGES) {
    if (badge.id in unlocked) continue;
    if (!badge.rule(stats)) continue;
    unlocked[badge.id] = Date.now();
    const { rule, ...rest } = badge;
    void rule;
    fresh.push(rest);
  }

  if (fresh.length > 0) writeUnlocked(unlocked);
  return fresh;
}

export function badgeStates(): BadgeState[] {
  const unlocked = readUnlocked();
  return BADGES.map(({ rule, ...badge }) => {
    void rule;
    return {
      ...badge,
      unlocked: badge.id in unlocked,
      unlockedAt: unlocked[badge.id] ?? null,
    };
  });
}

export const unlockedCount = (): number => Object.keys(readUnlocked()).length;
