import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createAudioBus, createInput, createRng, createStorage, dailySeed,
  DEFAULT_KEYMAP, PLAYER2_KEYMAP,
  type GameEvent, type GameInstance, type GameModule, type Action,
  type InputManager, type Keymap,
} from '@vevit-games/engine';
import {
  PauseOverlay, ResultScreen, Leaderboard, ControlsHint, TouchOverlay,
  categoryColors, colors, type LeaderboardEntry,
} from '@vevit-games/ui';
import { bySlug, catalog } from '../lib/catalog.js';
import { createScoreApi, fetchLeaderboard, EMPTY_LEADERBOARD, type LeaderboardData } from '../lib/api.js';
import {
  recordPlayed, loadFavorites, loadPlays, savePlays, type PortalSettings,
} from '../lib/settings.js';
import { completeChallenge, currentStreak } from '../lib/daily.js';
import { evaluateBadges, EMPTY_STATS, type Badge } from '../lib/badges.js';
import { navigate } from '../lib/router.js';
import { createRunTracker } from '../lib/run-tracker.js';
import type { I18n } from '../lib/i18n.js';

interface GamePageProps {
  slug: string;
  i18n: I18n;
  settings: PortalSettings;
  onSettingsChange(patch: Partial<PortalSettings>): void;
}

type Phase = 'loading' | 'ready' | 'playing' | 'paused' | 'finished' | 'error';

/** Dnešní datum v Praze — denní výzvy se resetují o půlnoci místního času. */
function pragueToday(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
}

export function GamePage({ slug, i18n, settings, onSettingsChange }: GamePageProps): JSX.Element {
  const entry = bySlug(slug);
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<GameInstance | null>(null);
  const moduleRef = useRef<GameModule | null>(null);
  // Vstup patří portálu, ne hře: obsluhuje ho i dotykový overlay a nastavení
  // přemapování kláves, které jsou mimo hru.
  const inputRef = useRef<InputManager | null>(null);
  // Druhá klávesnicová sada pro hry dvou hráčů na jednom počítači.
  const input2Ref = useRef<InputManager | null>(null);
  const [input, setInput] = useState<InputManager | null>(null);

  const [phase, setPhase] = useState<Phase>('loading');
  // Pauza, restart i události ze hry se ptají na aktuální fázi mimo render.
  const phaseRef = useRef<Phase>('loading');
  phaseRef.current = phase;
  const [mode, setMode] = useState<string>(() => {
    const requested = new URLSearchParams(window.location.search).get('rezim');
    const available = entry?.manifest.modes.map((m) => m.id) ?? [];
    return requested && available.includes(requested) ? requested : available[0] ?? 'klasik';
  });
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<{ score: number; won: boolean; stats?: Record<string, number> } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData>(EMPTY_LEADERBOARD);
  const [myEntry] = useState<LeaderboardEntry | null>(null);
  const [usedActions, setUsedActions] = useState<ReadonlySet<Action>>(new Set());
  const [needsRotate, setNeedsRotate] = useState(false);
  const [freshBadges, setFreshBadges] = useState<Badge[]>([]);
  // Restart volají i hry samy (událost `restart`), a to zevnitř běžící
  // smyčky — přes ref, aby se do nich nemusela protahovat aktuální funkce.
  const restartRef = useRef<() => void>(() => {});

  // Počty odehraných partií drží profil i odznaky; ukládají se lokálně.
  const playsRef = useRef<Record<string, number>>(loadPlays());

  const audio = useMemo(() => createAudioBus({
    master: settings.master, music: settings.music, sfx: settings.sfx, muted: settings.muted,
  }), []);

  // Hlídá, které spuštění hry je ještě aktuální. Bez něj po sobě překryvná
  // spuštění nechají běžet osiřelou hru, která pak hráči shodí živou partii.
  const runTracker = useMemo(() => createRunTracker(), []);

  const manifest = entry?.manifest;
  const modeSpec = manifest?.modes.find((m) => m.id === mode);
  const accent = manifest ? categoryColors[manifest.category] : colors.zelena;

  useEffect(() => {
    audio.setSettings({
      master: settings.master, music: settings.music, sfx: settings.sfx, muted: settings.muted,
    });
  }, [audio, settings.master, settings.music, settings.sfx, settings.muted]);

  // Zvuk smí nastartovat až po první interakci hráče — prohlížeč to vyžaduje.
  useEffect(() => {
    const unlock = (): void => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [audio]);

  // Orientace podle manifestu.
  useEffect(() => {
    if (!manifest || manifest.orientation === 'any') return;
    const check = (): void => {
      const portrait = window.innerHeight > window.innerWidth;
      const wrong = manifest.orientation === 'landscape' ? portrait : !portrait;
      // Výzvu k otočení dává smysl ukazovat jen na malé obrazovce.
      setNeedsRotate(wrong && window.innerWidth < 900);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [manifest]);

  const startGame = useCallback(async (): Promise<void> => {
    const host = hostRef.current;
    if (!entry || !host) return;

    // Doběhnout smí jen poslední spuštění. Mezi úklidem staré hry a `mount()`
    // se čeká na herní modul a na běh ze serveru; kdyby se za tu dobu spustila
    // hra znovu, namountovaly by se dvě a ta přebytečná by běžela dál.
    const run = runTracker.begin();

    instanceRef.current?.destroy();
    instanceRef.current = null;
    inputRef.current?.destroy();
    inputRef.current = null;
    input2Ref.current?.destroy();
    input2Ref.current = null;
    host.replaceChildren();
    setPhase('loading');
    setResult(null);
    setScore(0);
    setUsedActions(new Set());

    let module: GameModule;
    try {
      module = moduleRef.current ?? (await entry.load());
      moduleRef.current = module;
    } catch {
      if (run.current) setPhase('error');
      return;
    }
    if (!run.current) return;

    const storage = createStorage({
      gameSlug: entry.manifest.slug,
      version: entry.manifest.rulesVersion,
    });
    const scoringByMode = Object.fromEntries(
      entry.manifest.modes.map((m) => [m.id, m.scoring]),
    ) as Record<string, 'high' | 'low'>;
    const scores = createScoreApi(entry.manifest.slug, storage, scoringByMode);

    // Denní výzva má seed odvozený z data, ostatní režimy od serveru.
    const handle = mode === 'denni'
      ? { runId: null, seed: dailySeed(entry.manifest.slug, pragueToday()) }
      : await scores.start(mode);
    if (!run.current) return;

    /**
     * Po dohrané partii se zapíše denní výzva, přepočítají odznaky
     * a nové se ukážou hráči. Statistiky se berou z lokálního úložiště,
     * takže to funguje i bez přihlášení.
     */
    const recordOutcome = (score: number): void => {
      if (mode === 'denni') completeChallenge(entry.manifest.slug, score);

      const plays = { ...playsRef.current };
      plays[entry.manifest.slug] = (plays[entry.manifest.slug] ?? 0) + 1;
      playsRef.current = plays;
      savePlays(plays);

      const bestByGame = { ...EMPTY_STATS.best };
      for (const catalogEntry of catalog) {
        const slug = catalogEntry.manifest.slug;
        const localBest = createStorage({
          gameSlug: slug,
          version: catalogEntry.manifest.rulesVersion,
        }).getBest(catalogEntry.manifest.modes[0]?.id ?? 'klasik');
        if (localBest != null) bestByGame[slug] = localBest;
      }

      const earned = evaluateBadges({
        plays,
        best: bestByGame,
        streak: currentStreak(),
        dailyDone: Object.keys(plays).length,
        favorites: loadFavorites().length,
      });
      if (earned.length > 0) setFreshBadges(earned);
    };

    const onEvent = (event: GameEvent): void => {
      // Pojistka: nahrazený běh do portálu nemluví. Jeho `gameover` by jinak
      // ukončil partii, kterou hráč právě hraje.
      if (!run.current) return;
      switch (event.type) {
        case 'started':
          setPhase('playing');
          break;
        case 'paused':
          // Smyčka pauzuje i sama (ztráta fokusu). Dohranou partii tím ale
          // nesmí přebít — jinak by výsledek zmizel pod překryvem pauzy.
          if (phaseRef.current !== 'playing') break;
          inputRef.current?.reset();
          input2Ref.current?.reset();
          setPhase('paused');
          break;
        case 'score':
          setScore(event.value);
          break;
        case 'gameover':
          setResult({ score: event.score, won: false, stats: event.stats });
          setPhase('finished');
          recordOutcome(event.score);
          break;
        case 'win':
          setResult({ score: event.score, won: true, stats: event.stats });
          setPhase('finished');
          recordOutcome(event.score);
          break;
        case 'restart':
          restartRef.current();
          break;
        case 'error':
          setPhase('error');
          break;
        default:
          break;
      }
    };

    const gameInput = createInput({
      target: host,
      logicalWidth: entry.manifest.aspect.width,
      logicalHeight: entry.manifest.aspect.height,
      // Pořadí je záměrné: výchozí rozložení, pak rozložení hry a nakonec
      // přemapování hráče, které má vždycky poslední slovo.
      keymap: {
        ...DEFAULT_KEYMAP,
        ...(module.keymap as Partial<Keymap> | undefined),
        ...settings.keymap,
      },
    });
    inputRef.current = gameInput;
    setInput(gameInput);

    // Hry pro dva na jedné klávesnici dostanou druhou sadu (WASD).
    const local2P = entry.manifest.players.local && entry.manifest.players.max >= 2;
    const secondInput = local2P
      ? createInput({
        target: host,
        logicalWidth: entry.manifest.aspect.width,
        logicalHeight: entry.manifest.aspect.height,
        keymap: PLAYER2_KEYMAP,
      })
      : null;
    input2Ref.current = secondInput;

    instanceRef.current = module.mount(host, {
      input: gameInput,
      ...(secondInput ? { input2: secondInput } : {}),
      audio,
      rng: createRng(handle.seed),
      storage,
      scores,
      i18n: { locale: i18n.locale, t: i18n.t, pick: i18n.pick },
      theme: {
        accent: categoryColors[entry.manifest.category],
        background: colors.noc,
        surface: colors.pult,
        text: colors.text,
        textMuted: colors.textTlumeny,
        reducedMotion: settings.reducedMotion,
        colorblind: settings.colorblind,
        lowQuality: settings.lowQuality,
      },
      mode,
      seed: handle.seed,
      emit: onEvent,
    });

    recordPlayed(entry.manifest.slug);
  }, [
    entry, mode, audio, i18n, runTracker,
    settings.reducedMotion, settings.colorblind, settings.lowQuality, settings.keymap,
  ]);

  useEffect(() => {
    void startGame();
    return () => {
      // Zruší i spuštění, které je zrovna na půl cesty — jinak by domountovalo
      // hru, kterou už nikdo neuklidí.
      runTracker.cancel();
      instanceRef.current?.destroy();
      instanceRef.current = null;
      inputRef.current?.destroy();
      inputRef.current = null;
      input2Ref.current?.destroy();
      input2Ref.current = null;
    };
  }, [startGame, runTracker]);

  // Zvuková sběrnice drží AudioContext. Bez úklidu by po pár přechodech
  // mezi hrami narazila na limit prohlížeče a zvuk by přestal hrát.
  useEffect(() => () => audio.destroy(), [audio]);

  /**
   * Pauza, pokračování a restart mají jedno místo pro všechny tři vstupy
   * (lišta, Escape, překryv). Vstup se u každého z nich nuluje: stisk, který
   * padl mimo běžící smyčku, by se jinak odbavil až po návratu do hry.
   */
  const pauseGame = useCallback((): void => {
    if (phaseRef.current !== 'playing') return;
    instanceRef.current?.pause();
    inputRef.current?.reset();
    input2Ref.current?.reset();
    setPhase('paused');
  }, []);

  const resumeGame = useCallback((): void => {
    if (phaseRef.current !== 'paused') return;
    inputRef.current?.reset();
    input2Ref.current?.reset();
    instanceRef.current?.resume();
    setPhase('playing');
  }, []);

  /**
   * Restart je nové spuštění hry, ne jen `instance.restart()`: ten nechá
   * portálu staré skóre a hře starý běh i seed, takže další výsledek by
   * server odmítl. `startGame` sáhne pro nový běh a postaví hru od nuly.
   */
  const restartGame = useCallback((): void => {
    void startGame();
  }, [startGame]);

  useEffect(() => {
    restartRef.current = restartGame;
  }, [restartGame]);

  // Nápověda ovládání mizí po řádcích, jak hráč akce zkouší.
  useEffect(() => {
    if (!input || phase !== 'playing') return;
    const timer = window.setInterval(() => setUsedActions(new Set(input.usedActions)), 400);
    return () => window.clearInterval(timer);
  }, [input, phase]);

  useEffect(() => {
    if (!entry) return;
    void fetchLeaderboard(entry.manifest.slug, mode).then(setLeaderboard);
  }, [entry, mode]);

  // Escape je jediná klávesa, kterou portál hrám bere: přepíná pauzu.
  // Pokračování řeší překryv pauzy sám, tady se jen pauzuje.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      pauseGame();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pauseGame]);

  if (!entry || !manifest) {
    return (
      <div className="stav">
        <h1>{i18n.t('error.notFound')}</h1>
        <a className="tlacitko tlacitko--hlavni" href={`/${i18n.locale}/`}>{i18n.t('error.backHome')}</a>
      </div>
    );
  }

  const similar = catalog
    .filter((e) => e.manifest.category === manifest.category && e.manifest.slug !== slug)
    .slice(0, 4);

  return (
    <div className="hra" style={{ ['--akcent' as string]: accent }}>
      <div className="hra__lista">
        <a className="hra__zpet" href={`/${i18n.locale}/`}>
          <span aria-hidden="true">‹</span>
          <span className="hra__zpet-text">{i18n.t('nav.allGames')}</span>
        </a>
        <h1 className="hra__nazev">{manifest.title[i18n.locale]}</h1>
        <div className="hra__nastroje">
          <span className="hra__skore tabular">{score.toLocaleString('cs-CZ')}</span>
          <button
            type="button"
            className="hra__ikona"
            aria-pressed={settings.muted}
            onClick={() => onSettingsChange({ muted: !settings.muted })}
          >
            <span aria-hidden="true">{settings.muted ? '🔇' : '🔊'}</span>
            <span className="vizualne-skryte">
              {settings.muted ? 'Zapnout zvuk' : 'Ztlumit zvuk'}
            </span>
          </button>
          <button
            type="button"
            className="hra__ikona"
            onClick={pauseGame}
          >
            <span aria-hidden="true">⏸</span>
            <span className="vizualne-skryte">Pauza</span>
          </button>
        </div>
      </div>

      <div className="hra__telo">
        <div
          className="hra__plocha"
          style={{
            ['--pomer-w' as string]: manifest.aspect.width,
            ['--pomer-h' as string]: manifest.aspect.height,
          }}
        >
          <div className="hra__host" ref={hostRef} />

          {phase === 'loading' && <p className="hra__stav">{i18n.t('game.loading')}</p>}
          {phase === 'error' && (
            <div className="hra__stav">
              <p>{i18n.t('error.loadGame')}</p>
              <button type="button" className="tlacitko tlacitko--hlavni" onClick={() => void startGame()}>
                {i18n.t('error.retry')}
              </button>
            </div>
          )}
          {needsRotate && <p className="hra__otoc">{i18n.t('game.rotate')}</p>}

          {moduleRef.current?.controlHints && (
            <ControlsHint
              visible={phase === 'playing'}
              used={usedActions}
              anchor={moduleRef.current.hintAnchor}
              items={moduleRef.current.controlHints.map((hint) => ({
                action: hint.action as Action,
                label: hint.label,
                keys: hint.keys,
              }))}
            />
          )}

          {/* Dotykové ovládání patří nad herní plochu, ne nad celou stránku. */}
          {input && moduleRef.current?.touchButtons && (
            <TouchOverlay
              input={input}
              buttons={moduleRef.current.touchButtons.map((b) => ({ ...b, action: b.action as Action }))}
              leftHanded={settings.leftHanded}
              visible={phase === 'playing'}
            />
          )}
        </div>

        <aside className="hra__panel">
          <section>
            <h2>{i18n.t('game.mode')}</h2>
            <div className="rezimy">
              {manifest.modes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`rezim ${m.id === mode ? 'je-aktivni' : ''}`}
                  onClick={() => setMode(m.id)}
                >
                  {m.name[i18n.locale]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2>{i18n.t('game.controls')}</h2>
            <ul className="ovladani">
              {(moduleRef.current?.controlHints ?? []).map((hint) => (
                <li key={hint.action + hint.keys}>
                  <kbd>{hint.keys}</kbd>
                  <span>{hint.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>{i18n.t('game.leaderboard')}</h2>
            <Leaderboard entries={leaderboard} myEntry={myEntry} unit={modeSpec?.unit} />
          </section>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="podobne">
          <h2>{i18n.t('game.similar')}</h2>
          <ul>
            {similar.map((e) => (
              <li key={e.manifest.slug}>
                <a href={`/${i18n.locale}/${e.manifest.slug}`}>{e.manifest.title[i18n.locale]}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PauseOverlay
        open={phase === 'paused'}
        controls={(moduleRef.current?.controlHints ?? []).map((hint) => ({
          keys: hint.keys,
          label: hint.label,
        }))}
        onResume={resumeGame}
        onRestart={restartGame}
        onSettings={() => navigate(`/${i18n.locale}/nastaveni`)}
        onLeave={() => navigate(`/${i18n.locale}/`)}
      />

      {freshBadges.length > 0 && (
        <div className="odznak-toast" role="status" aria-live="polite">
          {freshBadges.map((badge) => (
            <p key={badge.id}>
              <strong>Nový odznak:</strong> {badge.title}
            </p>
          ))}
          <button type="button" onClick={() => setFreshBadges([])}>Zavřít</button>
        </div>
      )}

      <ResultScreen
        open={phase === 'finished' && result != null}
        title={result?.won ? i18n.t('game.youWon') : i18n.t('game.gameOver')}
        score={result?.score ?? 0}
        unit={modeSpec?.unit}
        personalBest={null}
        isNewBest={false}
        stats={Object.entries(result?.stats ?? {}).map(([label, value]) => ({
          label,
          value: String(value),
        }))}
        onRestart={restartGame}
        onLeave={() => navigate(`/${i18n.locale}/`)}
      />

    </div>
  );
}
