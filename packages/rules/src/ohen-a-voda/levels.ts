/**
 * Úrovně hry Oheň a Voda.
 *
 * Vlastní rozvržení. Všechny řádky mají stejnou délku.
 *
 * Legenda:
 *   `.` vzduch     `#` zeď      `=` plošina
 *   `f` ohnivá kaluž (projde Oheň)   `w` vodní kaluž (projde Voda)
 *   `x` žíravina (neprojde nikdo)
 *   `F` start Ohně   `W` start Vody
 *   `D` dveře Ohně   `E` dveře Vody
 *   `r` rubín (bere Oheň)   `m` modrá kapka (bere Voda)
 *   `B` tlačítko   `G` brána (otevřená, dokud někdo stojí na tlačítku)
 */

export interface LevelSpec {
  name: string;
  rows: string[];
}

export const LEVELS: LevelSpec[] = [
  {
    name: 'Seznámení',
    rows: [
      '########################',
      '#......................#',
      '#...r..............m...#',
      '#..===............===..#',
      '#......................#',
      '#........r....m........#',
      '#.....==========.......#',
      '#......................#',
      '#..F.....m....r.....W..#',
      '#####fff####wwww########',
      '#......................#',
      '#..D................E..#',
      '########################',
    ],
  },
  {
    name: 'Přes žíravinu',
    rows: [
      '########################',
      '#......................#',
      '#..r................m..#',
      '#.====..........====...#',
      '#..........r...........#',
      '#......======..........#',
      '#...m..............r...#',
      '#.====...........====..#',
      '#..F................W..#',
      '###fff###xxxxx###wwww###',
      '#......................#',
      '#....D..........E......#',
      '########################',
    ],
  },
  {
    name: 'Brána',
    rows: [
      '########################',
      '#......................#',
      '#...r...........m......#',
      '#..====.......====.....#',
      '#.........B............#',
      '#....==========........#',
      '#.........G............#',
      '#.........G......r.....#',
      '#..F......G.......W....#',
      '####ffff##G##wwww#######',
      '#.........G............#',
      '#...D.....G........E...#',
      '########################',
    ],
  },
];

export function validateLevel(level: LevelSpec): string[] {
  const problems: string[] = [];
  const width = level.rows[0]?.length ?? 0;
  level.rows.forEach((row, i) => {
    if (row.length !== width) problems.push(`Řádek ${i} má ${row.length} znaků místo ${width}.`);
    for (const char of row) {
      if (!'.#=fwxFWDErmBG'.includes(char)) problems.push(`Neznámý znak „${char}" na řádku ${i}.`);
    }
  });
  const count = (char: string): number =>
    level.rows.reduce((sum, row) => sum + [...row].filter((c) => c === char).length, 0);
  for (const char of 'FWDE') {
    if (count(char) !== 1) problems.push(`Znaků „${char}" je ${count(char)}, musí být právě jeden.`);
  }
  if (count('G') > 0 && count('B') === 0) {
    problems.push('Úroveň má bránu, ale žádné tlačítko.');
  }
  return problems;
}
