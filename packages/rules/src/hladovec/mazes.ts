/**
 * Bludiště pro Hladovce.
 *
 * Vlastní rozvržení, žádná kopie originálu. Každý řádek má přesně
 * 21 znaků; kontroluje to `validateMaze` i test.
 *
 * Legenda:
 *   `#` zeď, `.` tečka, `o` velká tečka, ` ` vnitřek doupěte,
 *   `-` dvířka doupěte, `T` průchozí okraj (tunel na druhou stranu).
 */

export const MAZE_W = 21;
export const MAZE_H = 21;

export const MAZES: string[][] = [
  [
    '#####################',
    '#o.......#.#.......o#',
    '#.###.##.#.#.##.###.#',
    '#...................#',
    '#.###.#.#####.#.###.#',
    '#.....#...#...#.....#',
    '#####.###.#.###.#####',
    '#####.#.......#.#####',
    '#####.#.##-##.#.#####',
    '#.....#.#   #.#.....#',
    'T.......#####.......T',
    '#####.#.......#.#####',
    '#####.#.#####.#.#####',
    '#####.#.......#.#####',
    '#...................#',
    '#.###.###.#.###.###.#',
    '#o..#.....#.....#..o#',
    '#.#.#.#.#####.#.#.#.#',
    '#.#...#...#...#...#.#',
    '#...................#',
    '#####################',
  ],
  [
    '#####################',
    '#o........#........o#',
    '#.###.###.#.###.###.#',
    '#.#.....#.#.#.....#.#',
    '#.#.###.#.#.#.###.#.#',
    '#...#.....#.....#...#',
    '###.#.#########.#.###',
    '#...#...........#...#',
    '#.#####.##-##.#####.#',
    '#.......#   #.......#',
    'T.#####.#####.#####.T',
    '#...........#.......#',
    '#.#####.#.#.#.#####.#',
    '#.....#.#.#.#.#.....#',
    '###.#.#.#.#.#.#.#.###',
    '#o..#...#...#...#..o#',
    '#.#############.#####',
    '#...................#',
    '#.###.#.#####.#####.#',
    '#.....#.....#.......#',
    '#####################',
  ],
];

/** Pole, kterými se dá projít. Vše kromě zdi. */
export const isOpen = (char: string): boolean => char !== '#';

/**
 * Kontrola tvaru bludiště. Vrací seznam problémů; prázdné pole znamená,
 * že je bludiště v pořádku. Volá se z testu, aby se překlep v datech
 * neprojevil až jako hráč zaseknutý ve zdi.
 */
export function validateMaze(maze: string[]): string[] {
  const problems: string[] = [];
  if (maze.length !== MAZE_H) {
    problems.push(`Bludiště má ${maze.length} řádků místo ${MAZE_H}.`);
  }
  maze.forEach((row, i) => {
    if (row.length !== MAZE_W) {
      problems.push(`Řádek ${i} má ${row.length} znaků místo ${MAZE_W}.`);
    }
  });

  // Okraj musí být zeď všude kromě tunelů. Chybějící spodní zeď je vidět
  // jako díra v bludišti, i když hráč skrz ni neprojde (mimo pole se nedá).
  const edgeProblem = (row: string, index: number, where: string): void => {
    if ([...row].every((char) => char === '#')) return;
    problems.push(`${where} (řádek ${index}) není zeď: ${row}`);
  };
  edgeProblem(maze[0] ?? '', 0, 'Horní okraj');
  edgeProblem(maze[maze.length - 1] ?? '', maze.length - 1, 'Spodní okraj');
  maze.forEach((row, i) => {
    const left = row[0];
    const right = row[row.length - 1];
    if (left !== '#' && left !== 'T') problems.push(`Levý okraj řádku ${i} není zeď ani tunel.`);
    if (right !== '#' && right !== 'T') problems.push(`Pravý okraj řádku ${i} není zeď ani tunel.`);
  });
  return problems;
}

/**
 * Startovní pole hráče: nejbližší průchozí pole ke středu spodní části.
 * Počítá se z dat, ne natvrdo — jinak by změna bludiště hráče postavila
 * doprostřed zdi.
 */
export function startPosition(maze: string[]): { x: number; y: number } {
  const centerX = Math.floor(MAZE_W / 2);
  for (let y = MAZE_H - 1; y >= 0; y--) {
    for (let offset = 0; offset <= centerX; offset++) {
      for (const x of [centerX - offset, centerX + offset]) {
        if (x < 0 || x >= MAZE_W) continue;
        const char = maze[y]?.[x];
        if (char != null && isOpen(char) && char !== '-' && char !== ' ') {
          return { x, y };
        }
      }
    }
  }
  return { x: 1, y: 1 };
}
