/**
 * Scény hry Šťastná opice.
 *
 * Každá scéna je malý hlavolam: poklikat na věci ve správném pořadí,
 * posbírat předměty a použít je tam, kde je jich potřeba. Data jsou
 * schválně oddělená od pravidel — přidat scénu znamená přidat záznam,
 * ne psát kód.
 *
 * Souřadnice jsou v herních pixelech scény 640×420.
 */

export const SCENE_W = 640;
export const SCENE_H = 420;

export type Backdrop = 'les' | 'jeskyne' | 'pobrezi' | 'domek';

export interface Hotspot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Popis pro čtečku obrazovky i pro bublinu při najetí. */
  label: string;
  /** Předmět, který je potřeba mít v ruce. */
  needs?: string;
  /** Předmět, který se sebráním získá. */
  gives?: string;
  /** Vyřeší scénu. */
  solves?: boolean;
  /** Po použití zmizí. */
  once?: boolean;
  /** Co hra řekne, když to vyjde. */
  hint: string;
  /** Co hra řekne, když předmět chybí. */
  missing?: string;
}

export interface Scene {
  name: string;
  backdrop: Backdrop;
  /** Co po hráči scéna chce. */
  goal: string;
  hotspots: Hotspot[];
}

export const SCENES: Scene[] = [
  {
    name: 'Na mýtině',
    backdrop: 'les',
    goal: 'Opice má hlad. Sežeň jí banán.',
    hotspots: [
      {
        id: 'kamen', x: 70, y: 300, w: 70, h: 50,
        label: 'Kámen', gives: 'klacek', once: true,
        hint: 'Pod kamenem ležel klacek.',
      },
      {
        id: 'palma', x: 430, y: 90, w: 120, h: 160,
        label: 'Palma s banánem', needs: 'klacek', gives: 'banan', once: true,
        hint: 'Klackem jsi banán srazil dolů.',
        missing: 'Na banán nedosáhneš. Něco dlouhého by pomohlo.',
      },
      {
        id: 'opice', x: 250, y: 230, w: 110, h: 140,
        label: 'Opice', needs: 'banan', solves: true,
        hint: 'Opice banán snědla a je šťastná!',
        missing: 'Opice kouká hladově. Banán by sedl.',
      },
    ],
  },
  {
    name: 'V jeskyni',
    backdrop: 'jeskyne',
    goal: 'Ve tmě není nic vidět. Rozsviť.',
    hotspots: [
      {
        id: 'hnizdo', x: 90, y: 120, w: 80, h: 60,
        label: 'Hnízdo', gives: 'susene-vetve', once: true,
        hint: 'V hnízdě byly suché větve.',
      },
      {
        id: 'pazourek', x: 480, y: 300, w: 70, h: 50,
        label: 'Pazourek', gives: 'pazourek', once: true,
        hint: 'Pazourek se bude hodit.',
      },
      {
        id: 'ohniste', x: 250, y: 280, w: 130, h: 90,
        label: 'Ohniště', needs: 'susene-vetve', gives: 'hranice', once: true,
        hint: 'Na ohništi je připravená hranice.',
        missing: 'Ohniště je prázdné. Chce to dříví.',
      },
      {
        id: 'zapal', x: 250, y: 200, w: 130, h: 70,
        label: 'Zapálit hranici', needs: 'pazourek', solves: true,
        hint: 'Jiskra chytla a jeskyně se rozzářila. Opice tleská!',
        missing: 'Bez jiskry to nechytne.',
      },
    ],
  },
  {
    name: 'Na pobřeží',
    backdrop: 'pobrezi',
    goal: 'Opice chce na ostrov. Potřebuje plavidlo.',
    hotspots: [
      {
        id: 'vrak', x: 60, y: 250, w: 120, h: 90,
        label: 'Vrak lodi', gives: 'prkno', once: true,
        hint: 'Z vraku jsi vypáčil prkno.',
      },
      {
        id: 'liana', x: 470, y: 100, w: 90, h: 140,
        label: 'Liána', gives: 'liana', once: true,
        hint: 'Liána se hodí na svázání.',
      },
      {
        id: 'vor', x: 250, y: 290, w: 140, h: 80,
        label: 'Stavět vor', needs: 'prkno', gives: 'vor-zaklad', once: true,
        hint: 'Prkna leží vedle sebe. Chce to svázat.',
        missing: 'Na vor je potřeba dřevo.',
      },
      {
        id: 'svazat', x: 250, y: 220, w: 140, h: 70,
        label: 'Svázat vor', needs: 'liana', solves: true,
        hint: 'Vor drží pohromadě a opice vesele mává!',
        missing: 'Prkna se rozjíždějí. Potřebuješ něco na svázání.',
      },
    ],
  },
  {
    name: 'U domku',
    backdrop: 'domek',
    goal: 'Domek je zamčený a klíč je v rybníku.',
    hotspots: [
      {
        id: 'sit', x: 80, y: 280, w: 90, h: 60,
        label: 'Síťka', gives: 'sitka', once: true,
        hint: 'Síťka na tyči — přesně na lovení z vody.',
      },
      {
        id: 'rybnik', x: 400, y: 300, w: 160, h: 80,
        label: 'Rybník', needs: 'sitka', gives: 'klic', once: true,
        hint: 'Síťkou jsi klíč vylovil.',
        missing: 'Klíč se leskne na dně. Rukou tam nedosáhneš.',
      },
      {
        id: 'dvere', x: 250, y: 170, w: 110, h: 170,
        label: 'Dveře domku', needs: 'klic', solves: true,
        hint: 'Zámek cvakl a opice běží dovnitř. Konec putování!',
        missing: 'Dveře jsou zamčené.',
      },
    ],
  },
];

/** Kontrola dat scény; prázdný seznam znamená, že je v pořádku. */
export function validateScene(scene: Scene): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const given = new Set<string>();

  for (const spot of scene.hotspots) {
    if (ids.has(spot.id)) problems.push(`Dvakrát stejné id „${spot.id}".`);
    ids.add(spot.id);
    if (spot.gives) given.add(spot.gives);
    if (spot.x < 0 || spot.y < 0 || spot.x + spot.w > SCENE_W || spot.y + spot.h > SCENE_H) {
      problems.push(`Místo „${spot.id}" leží mimo scénu.`);
    }
    if (spot.needs && !spot.missing) {
      problems.push(`Místo „${spot.id}" něco vyžaduje, ale neřekne co.`);
    }
  }

  for (const spot of scene.hotspots) {
    if (spot.needs && !given.has(spot.needs)) {
      problems.push(`Předmět „${spot.needs}" není ve scéně kde získat.`);
    }
  }
  if (!scene.hotspots.some((s) => s.solves)) problems.push('Scéna nejde vyřešit.');
  return problems;
}
