/**
 * Šťastná opice — klikací hlavolam.
 *
 * Pravidla jsou malý stavový automat nad daty scén: klikni na místo, hra
 * ověří, jestli máš potřebný předmět, a podle toho něco dá, vyřeší scénu
 * nebo napoví, co chybí. Žádná náhoda, takže běh je přehratelný.
 */

import { SCENES, type Hotspot, type Scene } from './scenes.js';

export const OPICE_RULES_VERSION = 1;

/** Kroků, po které nahoře visí hláška. */
export const MESSAGE_TICKS = 200;
/** Kroků oslavy mezi scénami. */
const SOLVED_TICKS = 120;

export interface OpiceState {
  scene: number;
  /** Id míst, která už zmizela. */
  used: string[];
  /** Posbírané předměty v pořadí. */
  inventory: string[];
  /** Předmět, který má hráč „v ruce"; `null` = nic. */
  held: string | null;
  message: string;
  messageTicks: number;
  /** Nálada opice: roste s úspěchem, klesá s marným klikáním. */
  mood: number;
  clicks: number;
  score: number;
  ticks: number;
  solved: boolean;
  won: boolean;
}

export interface OpiceGame {
  readonly state: OpiceState;
  readonly rulesVersion: number;
  readonly scenes: Scene[];
  /** Aktuální scéna se zbylými místy. */
  spots(): Hotspot[];
  /** Klik na místo podle id. Vrací `true`, když se něco stalo. */
  click(id: string): boolean;
  /** Vezme nebo odloží předmět z batohu. */
  hold(item: string | null): void;
  step(): void;
  loadScene(index: number): void;
}

export function createStastnaOpice(seed: string, startScene = 0): OpiceGame {
  void seed; // hra nemá náhodu

  const state: OpiceState = {
    scene: 0,
    used: [],
    inventory: [],
    held: null,
    message: '',
    messageTicks: 0,
    mood: 0.5,
    clicks: 0,
    score: 0,
    ticks: 0,
    solved: false,
    won: false,
  };

  const say = (text: string): void => {
    state.message = text;
    state.messageTicks = MESSAGE_TICKS;
  };

  const loadScene = (index: number): void => {
    const scene = SCENES[index];
    if (!scene) return;
    state.scene = index;
    state.used = [];
    state.inventory = [];
    state.held = null;
    state.solved = false;
    state.ticks = 0;
    state.mood = 0.5;
    say(scene.goal);
  };

  const spots = (): Hotspot[] =>
    (SCENES[state.scene]?.hotspots ?? []).filter((spot) => !state.used.includes(spot.id));

  const click = (id: string): boolean => {
    if (state.solved || state.won) return false;
    const spot = spots().find((s) => s.id === id);
    state.clicks++;
    if (!spot) {
      state.mood = Math.max(0, state.mood - 0.04);
      return false;
    }

    // Potřebný předmět stačí mít v batohu; držení v ruce je jen pohodlí.
    if (spot.needs && !state.inventory.includes(spot.needs)) {
      say(spot.missing ?? 'Tohle zatím nejde.');
      state.mood = Math.max(0, state.mood - 0.06);
      return false;
    }

    say(spot.hint);
    state.mood = Math.min(1, state.mood + 0.18);
    state.score += 50;

    if (spot.gives && !state.inventory.includes(spot.gives)) {
      state.inventory.push(spot.gives);
      state.held = spot.gives;
    }
    if (spot.once) state.used.push(spot.id);
    if (spot.solves) {
      state.solved = true;
      state.ticks = 0;
      // Méně kliknutí = víc bodů; minimum je počet míst ve scéně.
      const optimal = SCENES[state.scene]?.hotspots.length ?? 1;
      state.score += 300 + Math.max(0, (optimal * 3 - state.clicks)) * 25;
      state.clicks = 0;
    }
    return true;
  };

  const hold = (item: string | null): void => {
    if (item === null || state.inventory.includes(item)) state.held = item;
  };

  loadScene(startScene);

  return {
    state,
    rulesVersion: OPICE_RULES_VERSION,
    scenes: SCENES,
    spots,
    click,
    hold,
    loadScene,

    step() {
      if (state.won) return;
      state.ticks++;
      if (state.messageTicks > 0) state.messageTicks--;

      if (state.solved && state.ticks >= SOLVED_TICKS) {
        if (state.scene + 1 >= SCENES.length) state.won = true;
        else loadScene(state.scene + 1);
      }
    },
  };
}
