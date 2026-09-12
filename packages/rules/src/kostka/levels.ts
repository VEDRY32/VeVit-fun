/**
 * Úrovně Kostky.
 *
 * Vlastní rozvržení, žádná kopie cizí hry. Každý řádek má stejnou délku;
 * kontroluje to `validateLevel` i test.
 *
 * Legenda:
 *   ` ` prázdno (pád dolů)   `#` pevná dlaždice
 *   `k` křehká dlaždice — praskne, když na ní kostka stojí nastojato
 *   `s` spínač — přepne mosty, když na něj kostka šlápne
 *   `m` most vypnutý na začátku   `M` most zapnutý na začátku
 *   `o` cíl — kostka do něj musí spadnout nastojato
 *   `@` start kostky (stojí)
 */

export interface LevelSpec {
  name: string;
  rows: string[];
  /** Doporučený počet tahů; pod ním je řešení „čisté". */
  par: number;
}

export const LEVELS: LevelSpec[] = [
  {
    name: 'Rozcvička',
    par: 6,
    rows: [
      '          ',
      '  ######  ',
      '  #@####  ',
      '  ######  ',
      '   ####   ',
      '    #o#   ',
      '    ###   ',
      '          ',
    ],
  },
  {
    name: 'Úzká lávka',
    par: 12,
    rows: [
      '          ',
      ' ###      ',
      ' #@#      ',
      ' ###      ',
      '  ##      ',
      '  #####   ',
      '     ###  ',
      '     #o#  ',
      '     ###  ',
      '          ',
    ],
  },
  {
    name: 'Křehké dno',
    par: 14,
    rows: [
      '           ',
      '  ####     ',
      '  #@##     ',
      '  ####     ',
      '   kkk     ',
      '   ####    ',
      '    ####   ',
      '    #o##   ',
      '    ####   ',
      '           ',
    ],
  },
  {
    name: 'Spínač',
    par: 16,
    rows: [
      '            ',
      '  ####      ',
      '  #@#s      ',
      '  ####      ',
      '  ####      ',
      '  ##mm##    ',
      '      ###   ',
      '      #o#   ',
      '      ###   ',
      '            ',
    ],
  },
  {
    name: 'Dvě cesty',
    par: 20,
    rows: [
      '             ',
      '  ###        ',
      '  #@#        ',
      '  ###        ',
      '  ##kkk##    ',
      '  #s    m#   ',
      '  ####  M#   ',
      '     #####   ',
      '     #o###   ',
      '     #####   ',
      '             ',
    ],
  },
  {
    name: 'Ostrovy',
    par: 20,
    rows: [
      '              ',
      '  #####       ',
      '  #@###       ',
      '  #####       ',
      '  ##s##       ',
      '    mm        ',
      '    #####     ',
      '    #o###     ',
      '    #####     ',
      '              ',
    ],
  },
];

/** Kontrola tvaru úrovně; prázdný seznam znamená, že je v pořádku. */
export function validateLevel(level: LevelSpec): string[] {
  const problems: string[] = [];
  const width = level.rows[0]?.length ?? 0;
  if (width === 0) problems.push('Úroveň nemá žádné řádky.');

  level.rows.forEach((row, i) => {
    if (row.length !== width) {
      problems.push(`Řádek ${i} má ${row.length} znaků místo ${width}.`);
    }
    for (const char of row) {
      if (!' #ksmMo@'.includes(char)) problems.push(`Neznámý znak „${char}" na řádku ${i}.`);
    }
  });

  const count = (char: string): number =>
    level.rows.reduce((sum, row) => sum + [...row].filter((c) => c === char).length, 0);

  if (count('@') !== 1) problems.push(`Startů je ${count('@')}, musí být právě jeden.`);
  if (count('o') !== 1) problems.push(`Cílů je ${count('o')}, musí být právě jeden.`);
  if (count('s') === 0 && (count('m') > 0 || count('M') > 0)) {
    problems.push('Úroveň má mosty, ale žádný spínač, kterým by šly přepnout.');
  }
  return problems;
}
