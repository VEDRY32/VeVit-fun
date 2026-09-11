/** Veřejné rozhraní mezi portálem a hrou. Každá hra ho implementuje. */

import type { InputManager } from './input/input.js';
import type { AudioBus } from './audio/audio.js';
import type { Rng } from './rng.js';
import type { GameStorage } from './storage.js';

export type Locale = 'cs' | 'en';

export type GameCategory =
  | 'logika'   // Logika a slova
  | 'karty'    // Karty a klid
  | 'arkady'   // Arkády
  | 'akce'     // Akce a strategie
  | 'spolu'    // Multiplayer a deskovky
  | 'original'; // Originály VeVit

export interface LocalizedText {
  cs: string;
  en: string;
}

export interface GameMode {
  id: string;
  name: LocalizedText;
  /** Hodnocené režimy se zapisují do online žebříčku a validují se replayem. */
  ranked: boolean;
  /** Vyšší skóre vyhrává (body) vs. nižší vyhrává (čas). */
  scoring: 'high' | 'low';
  /** Jednotka skóre pro formátování ve výsledcích a žebříčku. */
  unit?: 'points' | 'ms' | 'moves' | 'lines';
}

export interface ControlSupport {
  keyboard: boolean;
  touch: boolean;
  gamepad: boolean;
  mouse: boolean;
}

export interface GameManifest {
  slug: string;
  title: LocalizedText;
  /** Krátký popis mechaniky. Nikdy nesmí jmenovat chráněný originál (D-012). */
  tagline: LocalizedText;
  category: GameCategory;
  tags: string[];
  modes: GameMode[];
  players: { min: number; max: number; local: boolean; online: boolean };
  controls: ControlSupport;
  /** Logické rozlišení herní plochy; portál podle něj dělá letterbox. */
  aspect: { width: number; height: number };
  orientation: 'any' | 'landscape' | 'portrait';
  avgSessionMin: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Verze pravidel skórování — mění se při změně, která by znehodnotila rekordy. */
  rulesVersion: number;
}

export interface ThemeContext {
  /** Barva kategorie v hex. */
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  reducedMotion: boolean;
  colorblind: boolean;
  /** Nízká kvalita grafiky — hra má vypnout částice a drahé efekty. */
  lowQuality: boolean;
}

export interface ScoreHandle {
  /** ID běhu od serveru; `null` u nehodnocených nebo offline běhů. */
  runId: string | null;
  seed: string;
}

export interface ScoreApi {
  /** Zahájí hodnocený běh. Server vrátí seed a run_id. */
  start(mode: string): Promise<ScoreHandle>;
  /** Odešle výsledek včetně replaye k ověření. */
  submit(result: SubmitResult): Promise<SubmitResponse>;
  /** Lokální rekord pro režim. */
  localBest(mode: string): number | null;
}

export interface SubmitResult {
  runId: string | null;
  mode: string;
  score: number;
  durationMs: number;
  /** Komprimovaný záznam vstupů pro serverovou validaci (D-008). */
  replay?: Uint8Array;
  /** Doplňující metriky do statistik (řádky, tahy, přesnost…). */
  stats?: Record<string, number>;
}

export interface SubmitResponse {
  accepted: boolean;
  personalBest: boolean;
  /** Pořadí v denním žebříčku, pokud ho server spočítal. */
  rank?: number;
  reason?: string;
}

export interface I18nApi {
  locale: Locale;
  /** Přeloží klíč; `{jméno}` v textu nahradí hodnotou z `vars`. */
  t(key: string, vars?: Record<string, string | number>): string;
  /** Vybere variantu z lokalizovaného objektu. */
  pick(text: LocalizedText): string;
}

export interface NetApi {
  send(type: string, payload: unknown): void;
  on(type: string, handler: (payload: unknown) => void): () => void;
  readonly connected: boolean;
  readonly latencyMs: number;
}

/** Vše, co hra dostane od portálu. Nic jiného si nesmí brát z globálu. */
export interface GameContext {
  input: InputManager;
  audio: AudioBus;
  rng: Rng;
  storage: GameStorage;
  scores: ScoreApi;
  i18n: I18nApi;
  theme: ThemeContext;
  /** Jen v online režimech. */
  net?: NetApi;
  /** Režim, ve kterém se hra spouští. */
  mode: string;
  /** Seed pro deterministický běh (denní výzva, hodnocený běh). */
  seed: string;
  /** Hra hlásí portálu události — ten na ně vykreslí overlay. */
  emit: (event: GameEvent) => void;
}

export type GameEvent =
  | { type: 'ready' }
  | { type: 'started' }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'score'; value: number }
  | { type: 'gameover'; score: number; durationMs: number; stats?: Record<string, number> }
  | { type: 'win'; score: number; durationMs: number; stats?: Record<string, number> }
  | { type: 'error'; message: string };

export interface GameInstance {
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
  /** Serializace rozehrané pozice pro „Pokračuj v hraní" (max 64 kB). */
  getSave?(): unknown;
  loadSave?(data: unknown): boolean;
}

/** Popis jednoho tlačítka dotykového overlay, který portál hře vykreslí. */
export interface TouchButtonSpec {
  action: string;
  label: string;
  /** Pozice v procentech herní plochy. */
  x: number;
  y: number;
  size?: number;
}

/** Řádek interaktivní nápovědy ovládání. */
export interface ControlHintSpec {
  action: string;
  label: string;
  keys: string;
}

export interface GameModule {
  manifest: GameManifest;
  /**
   * Vlastní rozložení kláves. Portál ho použije, když hře vytváří vstup —
   * hra si vstup nevytváří sama, aby ho uměl obsluhovat i dotykový overlay.
   */
  keymap?: Partial<Record<string, string[]>>;
  /** Dotykové ovládání — portál z toho poskládá overlay. */
  touchButtons?: TouchButtonSpec[];
  /** Nápověda ovládání při prvním spuštění. */
  controlHints?: ControlHintSpec[];
  /**
   * Roh, ve kterém nápověda ovládání leží. Hry s ovládacími prvky vlevo
   * dole (číselník, tlačítka) si zvolí jiný, aby je nezakrývala.
   */
  hintAnchor?: 'vlevo-dole' | 'vlevo-nahore' | 'vpravo-dole' | 'vpravo-nahore';
  mount(el: HTMLElement, ctx: GameContext): GameInstance;
  /** Samohrající ukázka pro hero a dlaždice. `t` je čas v sekundách. */
  renderAttract(canvas: HTMLCanvasElement, t: number): void;
}
