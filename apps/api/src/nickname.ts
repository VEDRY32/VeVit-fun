/**
 * Přezdívky.
 *
 * Portál hrají děti, takže přezdívky procházejí filtrem a hosté dostanou
 * vygenerované jméno místo volného textu (zadání 5.6, 6).
 */

import type { Rng } from '@vevit-games/engine/core';

const ADJECTIVES = [
  'Rychlý', 'Tichý', 'Statečný', 'Zvědavý', 'Veselý', 'Chytrý', 'Mrštný',
  'Pozorný', 'Klidný', 'Hravý', 'Bystrý', 'Odvážný', 'Přátelský', 'Šikovný',
];

const ANIMALS = [
  'Jezevec', 'Rys', 'Bobr', 'Sokol', 'Ježek', 'Vydra', 'Los', 'Kamzík',
  'Datel', 'Čáp', 'Krtek', 'Sýček', 'Tchoř', 'Zajíc',
];

/** Náhodná přezdívka hosta: přídavné jméno a zvíře. */
export function guestNickname(rng: Rng): string {
  return `${rng.pick(ADJECTIVES)} ${rng.pick(ANIMALS)}`;
}

/**
 * Zjednodušený filtr vulgarismů cs/en.
 *
 * Kořeny jsou psané bez diakritiky, protože normalizace ji stejně odstraní.
 * Filtr je záměrně konzervativní: falešně pozitivní výsledek hráče jen donutí
 * zvolit jinou přezdívku, propuštěný vulgarismus uvidí všichni.
 */
const BANNED_ROOTS = [
  'kurv', 'pic', 'sra', 'hovn', 'debil', 'idiot', 'mrd', 'zmrd', 'prdel',
  'kokot', 'buzer', 'fuck', 'shit', 'bitch', 'cunt', 'nigg', 'rape', 'nazi',
  'hitler', 'porn',
];

/**
 * Sjednotí zápis tak, aby se filtr nedal obejít diakritikou, číslicemi
 * místo písmen, oddělovači ani zdvojováním znaků.
 */
function normalizeForFilter(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a')
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1');
}

export function containsProfanity(text: string): boolean {
  const normalized = normalizeForFilter(text);
  return BANNED_ROOTS.some((root) => normalized.includes(normalizeForFilter(root)));
}

export interface NicknameCheck {
  ok: boolean;
  reason?: string;
  /** Očištěná přezdívka, když projde. */
  value?: string;
}

export function validateNickname(raw: string): NicknameCheck {
  // \p{Cc} jsou řídicí znaky, \p{Cf} neviditelné formátovací (zero-width
  // mezery, přepínače směru textu). Obojí se dá zneužít k rozbití rozhraní
  // nebo k obejití filtru.
  const cleaned = raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim()
    .replace(/\s+/gu, ' ');

  if (cleaned.length < 2) return { ok: false, reason: 'Přezdívka musí mít aspoň dva znaky.' };
  if (cleaned.length > 18) return { ok: false, reason: 'Přezdívka může mít nejvýš 18 znaků.' };
  if (!/^[\p{L}\p{N} _-]+$/u.test(cleaned)) {
    return { ok: false, reason: 'Použij jen písmena, číslice, mezeru, pomlčku nebo podtržítko.' };
  }
  if (containsProfanity(cleaned)) {
    return { ok: false, reason: 'Tuhle přezdívku použít nemůžeš. Zkus jinou.' };
  }
  return { ok: true, value: cleaned };
}
