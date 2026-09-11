/**
 * Slovníky pro Pětipísmenku (česká verze).
 *
 * `ANSWERS` jsou slova, která hra může zvolit jako tajná: běžná, spisovná,
 * podstatná jména v 1. pádě, bez vlastních jmen a vulgarismů.
 * `ALLOWED` je širší seznam, který hra přijme jako tip — obsahuje navíc
 * přídavná jména a tvary, které by jako tajné slovo byly nefér.
 *
 * Stav: startovní ručně kurátorovaná sada (210 odpovědí). Cílových
 * ~2 500 slov doplní pipeline v apps/worker/scripts/wordlists; formát dat
 * se tím nemění.
 *
 * Písmena s diakritikou jsou samostatné znaky (á ≠ a) a „ch" se počítá
 * jako dva znaky — viz packages/rules/src/petipismenka/evaluate.ts.
 */

export const ANSWERS: readonly string[] = [
  'banán', 'barva', 'bazén', 'beran', 'bidlo', 'bílek', 'bobek', 'bodák',
  'borec', 'brána', 'brzda', 'bubák', 'budík', 'buřič', 'cesta', 'chleb',
  'čapka', 'datum', 'dálka', 'deska', 'divák', 'dlaha', 'domek', 'dráha',
  'duben', 'důlek', 'dveře', 'dýmka', 'filtr', 'forma', 'fotka', 'garáž',
  'haluz', 'hasič', 'hejno', 'heslo', 'hlava', 'hlína', 'holka', 'holub',
  'honba', 'houba', 'hraní', 'hrách', 'hrnec', 'hudba', 'humor', 'jazyk',
  'jádro', 'jedle', 'jehla', 'jelen', 'ježek', 'jídlo', 'kabát', 'kadeř',
  'kanoe', 'kapka', 'kapsa', 'karta', 'kašna', 'kámen', 'klika', 'kniha',
  'kolej', 'kolem', 'komár', 'konec', 'konev', 'kopec', 'koráb', 'korek',
  'košík', 'kotel', 'kotva', 'koule', 'kovář', 'krása', 'kráva', 'křída',
  'lampa', 'lávka', 'letec', 'lékař', 'listí', 'liška', 'loket', 'louka',
  'louže', 'lovec', 'lžíce', 'malíř', 'matka', 'měsíc', 'mince', 'mléko',
  'motor', 'mouka', 'mrkev', 'mucha', 'mýdlo', 'nápad', 'národ', 'nemoc',
  'nitka', 'nosič', 'nudle', 'nůžky', 'obilí', 'obraz', 'obruč', 'oceán',
  'okraj', 'oliva', 'opice', 'ovoce', 'palec', 'palma', 'panák', 'papír',
  'pasta', 'patro', 'pátek', 'pilot', 'písek', 'píseň', 'pomoc', 'potok',
  'prach', 'práce', 'ptáci', 'pytel', 'salát', 'sedlo', 'sirup', 'skála',
  'sklad', 'sklep', 'skoba', 'slovo', 'smích', 'sobol', 'sokol', 'sonda',
  'spona', 'sport', 'srdce', 'stěna', 'stopa', 'strom', 'sukně', 'sukno',
  'svaly', 'svíce', 'šípek', 'škola', 'šňůra', 'štika', 'talíř', 'tábor',
  'tečka', 'teplo', 'terén', 'tíseň', 'tráva', 'trend', 'trika', 'tuleň',
  'tužka', 'ubrus', 'uhlíř', 'ulice', 'úterý', 'vagón', 'vazba', 'válec',
  'vánek', 'vážka', 'vedro', 'vejce', 'verše', 'veslo', 'vesta', 'věnec',
  'větev', 'vidle', 'vítěz', 'vlasy', 'vláha', 'vlčák', 'vodák', 'vojín',
  'volno', 'vrata', 'vrána', 'výhra', 'výkon', 'výtah', 'zákon', 'zámek',
  'zápas', 'závěs', 'zdroj', 'zebra', 'zeman', 'zrada', 'zubař', 'zvíře',
  'zvuky', 'život',
];

const EXTRA_GUESSES: readonly string[] = [
  'banán', 'barva', 'bazén', 'beran', 'bidlo', 'bílek', 'blíže', 'bobek',
  'bodák', 'borec', 'brána', 'brzda', 'bubák', 'budík', 'buřič', 'cesta',
  'chleb', 'čapka', 'datum', 'dálka', 'deska', 'divák', 'dlaha', 'dobrý',
  'domek', 'dráha', 'duben', 'důlek', 'dveře', 'dýmka', 'filtr', 'forma',
  'fotka', 'garáž', 'haluz', 'hasič', 'hejno', 'heslo', 'hlava', 'hlína',
  'holka', 'holub', 'honba', 'houba', 'hraní', 'hrách', 'hrnec', 'hudba',
  'humor', 'jazyk', 'jádro', 'jedle', 'jehla', 'jelen', 'ježek', 'jídlo',
  'kabát', 'kadeř', 'kanoe', 'kapka', 'kapsa', 'karta', 'kašna', 'kámen',
  'klika', 'kniha', 'kolej', 'kolem', 'komár', 'konec', 'konev', 'kopec',
  'koráb', 'korek', 'košík', 'kotel', 'kotva', 'koule', 'kovář', 'krása',
  'kráva', 'křída', 'lampa', 'lávka', 'lehký', 'letec', 'lékař', 'listí',
  'liška', 'loket', 'louka', 'louže', 'lovec', 'lžíce', 'malíř', 'matka',
  'měsíc', 'mince', 'mléko', 'modrý', 'mokrý', 'motor', 'mouka', 'mrkev',
  'mucha', 'mýdlo', 'nápad', 'národ', 'nemoc', 'nitka', 'nosič', 'nudle',
  'nůžky', 'obilí', 'obraz', 'obruč', 'oceán', 'okraj', 'oliva', 'opice',
  'ovoce', 'palec', 'palma', 'panák', 'papír', 'pasta', 'patro', 'pátek',
  'pilot', 'písek', 'píseň', 'plaza', 'pomoc', 'potok', 'prach', 'práce',
  'ptáci', 'pytel', 'salát', 'sedlo', 'sirup', 'skála', 'sklad', 'sklep',
  'skoba', 'slovo', 'smích', 'sobol', 'sokol', 'sonda', 'spona', 'sport',
  'srdce', 'stará', 'stěna', 'stopa', 'strom', 'sukně', 'sukno', 'svaly',
  'svíce', 'šípek', 'škola', 'šňůra', 'štika', 'talíř', 'tábor', 'tečka',
  'teplo', 'terén', 'tíseň', 'tráva', 'trend', 'trika', 'trpký', 'tuleň',
  'tužka', 'ubrus', 'uhlíř', 'ulice', 'úterý', 'vagón', 'vazba', 'válec',
  'vánek', 'vážka', 'vážný', 'vedro', 'vejce', 'verše', 'veslo', 'vesta',
  'věnec', 'větev', 'vidle', 'vítěz', 'vlasy', 'vláha', 'vlčák', 'vodák',
  'vojín', 'volno', 'vrata', 'vrána', 'výhra', 'výkon', 'výtah', 'zákon',
  'zámek', 'zápas', 'závěs', 'zdroj', 'zebra', 'zebry', 'zeman', 'zrada',
  'zubař', 'zvíře', 'zvuky', 'žehla', 'život',
];

/** Vše, co hra přijme jako tip. */
export const ALLOWED: ReadonlySet<string> = new Set([...ANSWERS, ...EXTRA_GUESSES]);

/** Tajné slovo pro daný den — stejné pro všechny hráče. */
export function answerForDay(dayNumber: number): string {
  return ANSWERS[dayNumber % ANSWERS.length]!;
}
