/**
 * Slovníky pro Pětipísmenku (česká verze).
 *
 * `ANSWERS` jsou slova, která hra může zvolit jako tajná: běžná, spisovná,
 * podstatná jména v 1. pádě, bez vlastních jmen a vulgarismů.
 * `ALLOWED` je širší seznam, který hra přijme jako tip — obsahuje navíc
 * přídavná jména a tvary, které by jako tajné slovo byly nefér.
 *
 * Stav: ručně kurátorovaná sada (418 odpovědí, 446 tipů).
 * Cílových ~2 500 slov doplní pipeline v apps/worker/scripts/wordlists;
 * formát dat se tím nemění.
 *
 * Písmena s diakritikou jsou samostatné znaky (á ≠ a) a „ch" se počítá
 * jako dva znaky — viz packages/rules/src/petipismenka/evaluate.ts.
 */

export const ANSWERS: readonly string[] = [
  'banán', 'barva', 'bazén', 'bedna', 'beran', 'bidlo', 'bobek', 'bodák',
  'borec', 'brzda', 'brána', 'brýle', 'bubák', 'budík', 'buřič', 'bílek',
  'cesta', 'chleb', 'cihla', 'datel', 'datum', 'dcera', 'deska', 'dieta',
  'divák', 'dlaha', 'dláto', 'dobro', 'dolar', 'domek', 'dopis', 'drama',
  'dráha', 'duben', 'dudek', 'dveře', 'dálka', 'dárek', 'dýmka', 'dřevo',
  'důlek', 'farma', 'filtr', 'forma', 'fotka', 'garáž', 'haluz', 'hasič',
  'hejno', 'heslo', 'hlava', 'hlína', 'holka', 'holub', 'honba', 'houba',
  'houby', 'hrady', 'hraní', 'hrnec', 'hrách', 'hudba', 'humor', 'jazyk',
  'jedle', 'jehla', 'jehně', 'jelen', 'jeřáb', 'ježek', 'jizva', 'jméno',
  'jádro', 'jídlo', 'kabel', 'kabát', 'kadeř', 'kaluž', 'kanoe', 'kanál',
  'kapka', 'kapsa', 'karta', 'kašna', 'klika', 'kluci', 'klíny', 'klíče',
  'kniha', 'kolej', 'kolem', 'kolík', 'komár', 'komín', 'konec', 'konev',
  'kopec', 'kopie', 'korek', 'koráb', 'korýš', 'kotel', 'kotva', 'koule',
  'kovář', 'kozel', 'košík', 'krize', 'krtek', 'kruhy', 'krása', 'kráva',
  'krčma', 'kufry', 'kvítí', 'kytka', 'kámen', 'křída', 'kůlna', 'kůzle',
  'lahev', 'lampa', 'lampy', 'lanko', 'ledek', 'lesík', 'letec', 'limit',
  'linka', 'listí', 'liška', 'loket', 'louka', 'louže', 'lovec', 'lupen',
  'lávka', 'lázně', 'lékař', 'lžíce', 'madlo', 'maják', 'malba', 'malíř',
  'maska', 'matka', 'metla', 'mince', 'mléko', 'mlýny', 'morče', 'motor',
  'mouka', 'mrazy', 'mrkev', 'mucha', 'mušle', 'mýdlo', 'měsíc', 'mříže',
  'nehet', 'nemoc', 'nitka', 'nosič', 'nožík', 'nudle', 'nábor', 'náhon',
  'nápad', 'nápoj', 'národ', 'násep', 'nůžky', 'obilí', 'objev', 'oblek',
  'obraz', 'obruč', 'oceán', 'odpad', 'okraj', 'oliva', 'opice', 'opora',
  'otisk', 'ovoce', 'ovčák', 'palec', 'palma', 'palác', 'panda', 'panel',
  'panák', 'papír', 'pasta', 'patka', 'patro', 'pecka', 'pekáč', 'penál',
  'pilot', 'pilíř', 'plech', 'plody', 'ploty', 'pluky', 'pobyt', 'podíl',
  'pohyb', 'pojem', 'pokoj', 'pokus', 'pomoc', 'popel', 'porce', 'posel',
  'potah', 'potok', 'pouta', 'pozor', 'prach', 'prkno', 'práce', 'ptáci',
  'pumpa', 'puška', 'pytel', 'pádlo', 'pásek', 'pásmo', 'pátek', 'pírko',
  'písek', 'píseň', 'půlka', 'rakev', 'rande', 'rebel', 'regál', 'rohož',
  'rosol', 'ruina', 'rukáv', 'rybíz', 'rádio', 'rámec', 'salát', 'sedlo',
  'senát', 'sever', 'sirka', 'sirup', 'sklad', 'sklep', 'skoba', 'skála',
  'skříň', 'sloup', 'slovo', 'sluha', 'sláma', 'smetí', 'smysl', 'smích',
  'směna', 'smůla', 'sobol', 'socha', 'sodík', 'sojka', 'sokol', 'sonda',
  'spisy', 'spona', 'sport', 'spěch', 'srdce', 'srnec', 'srnka', 'stopa',
  'stroj', 'strom', 'stádo', 'stěna', 'střed', 'sukno', 'sukně', 'svaly',
  'svetr', 'svíce', 'sádlo', 'sádra', 'sáček', 'síťka', 'tabák', 'tajga',
  'talíř', 'tanec', 'taška', 'tenis', 'teplo', 'terén', 'tečka', 'tlapa',
  'topol', 'torzo', 'trefa', 'trend', 'trest', 'trika', 'trnka', 'tráva',
  'tuleň', 'tulák', 'tužka', 'tvary', 'tykev', 'tyčka', 'tábor', 'tácek',
  'tíseň', 'těsto', 'ubrus', 'uhlíř', 'ulice', 'vagón', 'vazba', 'vařič',
  'vedro', 'vejce', 'verze', 'verše', 'veslo', 'vesta', 'vichr', 'vidle',
  'viník', 'vlaky', 'vlasy', 'vlnka', 'vláda', 'vláha', 'vlčák', 'vodka',
  'vodák', 'vodík', 'voják', 'vojín', 'volno', 'vozík', 'vrata', 'vrták',
  'vrána', 'vrány', 'vydra', 'válec', 'vánek', 'vážka', 'vítěz', 'výběr',
  'výhra', 'výkon', 'výmol', 'výpad', 'výtah', 'výška', 'včela', 'vědro',
  'věnec', 'větev', 'vězeň', 'věšák', 'zbraň', 'zdivo', 'zdroj', 'zebra',
  'zeleň', 'zeman', 'zlato', 'zmije', 'zrada', 'zubař', 'zvuky', 'zvíře',
  'zájem', 'zákal', 'zákon', 'zámek', 'zápas', 'zátka', 'závod', 'závěj',
  'závěs', 'únava', 'úterý', 'čapka', 'řemen', 'řetěz', 'šance', 'šatna',
  'šipka', 'šiška', 'škola', 'šperk', 'štika', 'štěrk', 'šálek', 'šátek',
  'šípek', 'šňůra', 'želva', 'žemle', 'žezlo', 'židle', 'živel', 'život',
  'žluva', 'župan',
];

/** Slova navíc, která hra bere jako tip, ale netipuje je jako tajná. */
const EXTRA_GUESSES: readonly string[] = [
  'blíže', 'dobrý', 'dýchá', 'hodně', 'jarní', 'kapek', 'kapot',
  'klubu', 'korun', 'kosti', 'krabí', 'lehký', 'modrý', 'mokrá',
  'mokrý', 'mysli', 'orlík', 'ovsík', 'plaza', 'stará', 'tahle', 'tehdy',
  'trpký', 'tuhle', 'ujetá', 'vážný', 'zebry', 'žehla',
];

/** Vše, co hra přijme jako tip. */
export const ALLOWED: ReadonlySet<string> = new Set([...ANSWERS, ...EXTRA_GUESSES]);

/** Tajné slovo pro daný den — stejné pro všechny hráče. */
export function answerForDay(dayNumber: number): string {
  return ANSWERS[dayNumber % ANSWERS.length]!;
}
