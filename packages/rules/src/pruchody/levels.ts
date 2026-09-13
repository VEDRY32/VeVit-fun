/**
 * Úrovně Průchodů.
 *
 * Legenda:
 *   `.` prázdno   `#` stěna (unese průchod)   `x` kov (průchod neunese)
 *   `^` nástrahy  `B` start kuličky           `C` cíl
 */

export interface LevelSpec {
  name: string;
  rows: string[];
  hint: string;
}

export const LEVELS: LevelSpec[] = [
  {
    name: 'První pád',
    hint: 'Polož oba průchody tak, aby kulička doletěla k cíli.',
    rows: [
      '####################',
      '#..B...............#',
      '#..................#',
      '#..................#',
      '#........C.........#',
      '#..................#',
      '####################',
    ],
  },
  {
    name: 'Přes kov',
    hint: 'Na kovovou stěnu průchod nejde. Obejdi ji.',
    rows: [
      '####################',
      '#..B...............#',
      '#....xxxxxx........#',
      '#..................#',
      '#........xxx.......#',
      '#..............C...#',
      '#..................#',
      '####################',
    ],
  },
  {
    name: 'Rozlet',
    hint: 'Pád zrychluje. Hybnost si vezmi s sebou.',
    rows: [
      '####################',
      '#..B...............#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#^^^^^^^^^^^^^.....#',
      '#..............C...#',
      '####################',
    ],
  },
  {
    name: 'Past',
    hint: 'Nástrahy dole nepustí. Nahoře je volno.',
    rows: [
      '####################',
      '#..............C...#',
      '#........xxxxxxxx..#',
      '#..B...............#',
      '#..................#',
      '#....^^^^^^^^^^....#',
      '#..................#',
      '####################',
    ],
  },
];

export function validateLevel(level: LevelSpec): string[] {
  const problems: string[] = [];
  const width = level.rows[0]?.length ?? 0;
  level.rows.forEach((row, i) => {
    if (row.length !== width) problems.push(`Řádek ${i} má ${row.length} znaků místo ${width}.`);
    for (const char of row) {
      if (!'.#x^BC'.includes(char)) problems.push(`Neznámý znak „${char}" na řádku ${i}.`);
    }
  });
  const count = (char: string): number =>
    level.rows.reduce((sum, row) => sum + [...row].filter((c) => c === char).length, 0);
  if (count('B') !== 1) problems.push(`Startů je ${count('B')}, musí být právě jeden.`);
  if (count('C') !== 1) problems.push(`Cílů je ${count('C')}, musí být právě jeden.`);
  if (count('#') === 0) problems.push('Úroveň nemá stěnu, na kterou by šel položit průchod.');
  return problems;
}
