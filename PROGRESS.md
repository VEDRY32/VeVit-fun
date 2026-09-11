# Průběh

Stav k poslednímu commitu. Co tu není jako hotové, hotové není.

---

## F0 — Průzkum a plán ✅

**Zjištění.** Repo bylo prázdné — žádné monorepo, auth vrstva, migrace ani
design tokeny. Zadání předpokládá opak, takže podle pravidla „vyhrává repo"
stavíme samostatný projekt (D-001) na doméně vevit.fun (D-002).

**Hotovo.** pnpm workspace, PLAN.md (struktura, fáze, 8 rizik), DECISIONS.md
(D-001…D-012), THIRD_PARTY.md, ops/ (compose, Caddyfile s per-route CSP,
RUNBOOK, smoke a rollback skript), `scripts/check-ip.mjs` v CI.

---

## F1 — Základ a vlajkové singleplayer hry 🟡 rozpracováno

### Hotovo

**Engine `@vevit-games/engine`**
- smyčka s fixním krokem 60 Hz, interpolace renderu, automatická pauza,
  pojistka proti spirále smrti
- RNG sfc32 ze seedu, uložitelný stav, fork
- fixed-point Q16.16 včetně tabulkového sinu a celočíselné odmocniny (D-010)
- vstup: klávesnice, gamepad, dotyk, ukazatel → abstraktní akce; DAS/ARR;
  bitová maska pro replay; headless varianta pro server
- audio: vlastní ZzFX, sekvencer, oddělené hlasitosti, kontext po první interakci
- render: logické rozlišení, letterbox, devicePixelRatio, kreslicí pomůcky
- replay: běhová délka (6000 kroků < 100 bajtů), odolný parser
- utility: částice s poolem, tweeny, kamera, prostorová hash mapa, A*,
  kostrová animace loutek
- serverový vstup `@vevit-games/engine/core` bez závislosti na DOM

**Pravidla `@vevit-games/rules`**
- Kostkopád: rotační systém s wall-kicky (vlastní tabulka pro I, vlastní
  rozšíření pro 180°), detekce T-otočky pravidlem tří rohů včetně mini,
  „sedm v pytli", držení, duch, prodleva uzamčení s 15 resety, bodování
  s combem a sérií, tabulka gravitace, odpadní řádky pro souboj
- Zdvojka, Had, Hledač min (včetně režimu bez hádání s řešičem)
- Pětipísmenka: dvouprůchodové vyhodnocení opakovaných písmen, diakritika
  jako samostatné písmeno, těžký režim, emoji mřížka
- validace replaye: server přehraje běh a porovná skóre, seed, režim i verzi

**Portál a UI**
- vlastní router, domovská stránka s živou hrou dne, police kategorií,
  stránka hry, hledání bez diakritiky, kategorie, nastavení, 404
- tokeny, GameTile, CategoryShelf, PauseOverlay, ResultScreen, Leaderboard,
  ControlsHint, TouchOverlay

**API**
- runs/start a runs/submit s ověřením vlastnictví a validací replaye
- denní slovní hra vyhodnocovaná na serveru
- žebříčky, tickety pro realtime, rate limit, filtr přezdívek
- SQL migrace schématu `games` s RLS deny-all

**Hry hratelné od startu do konce:** Kostkopád, Pětipísmenka, Zdvojka, Had,
Hledač min.

### Ověřeno

| Kontrola | Výsledek |
|---|---|
| Unit testy | 180 (engine 38, rules 112, api 30) |
| Kouřový test v prohlížeči | desktop 1440 + mobil 390, 5 her, 0 chyb v konzoli |
| Initial JS portálu | **57,6 kB gzip** (limit 130) |
| Největší chunk hry | **16,5 kB gzip** (limit 250) |
| Typecheck | engine, rules, ui, portal, api — čistý |
| Kontrola chráněných názvů | prošla |

### Chyby nalezené a opravené při revizi

1. Čtverec se rotací posouval v obalovém čtverci — teď se neotáčí vůbec.
2. Wall-kick tabulky vracely `-0`, které se v porovnáních chová jinak než `0`.
3. `margin: 0 auto` na položce mřížky vypnulo roztažení a herní plocha se
   smrskla na 2 px. Kouřový test na to má teď kontrolu velikosti.
4. Dotykové ovládání se vykreslovalo nad celou stránkou, takže tlačítka
   ležela na postranním panelu.
5. Attract ukázky se v čase 0 kreslily prázdné.
6. `rules` táhl přes barrel enginu kód závislý na DOM → API nešlo přeložit.
7. SQL migrace odkazovala na `games.users` dřív, než ji vytvořila.

### Nehotovo z F1

- [ ] **Přihořívá** — chybí. Potřebuje fastText vektory (~1 GB ke stažení
      a předzpracování) a běžící worker; bez VPS a diskového prostoru to
      nemá kam.
- [ ] **Pasiánsy** — chybí.
- [ ] **Slovník Pětipísmenky** — 210 ručně prošlých slov místo cílových
      ~2 500. Formát dat je hotový, doplnění je práce pipeline ve workeru.
- [ ] **Online souboj Kostkopádu** — pravidla pro odpadní řádky hotová,
      chybí realtime vrstva (F3).
- [ ] **Přemapování kláves v nastavení** — engine ho umí, UI pro něj chybí.
- [ ] **Cloud sync uložených pozic** — rozhraní hotové, endpoint chybí.
- [ ] **Vygenerované statické covery při buildu** — dlaždice zatím kreslí
      attract mód v prohlížeči.
- [ ] **Self-hostovaná písma** — portál běží na systémovém fallbacku.
- [ ] **Nasazení** — chybí přístup na VPS, DNS i Supabase.

---

## F2–F5 — nezahájeno

Zbývá 40 klonů z katalogu, 12 originálů VeVit, celá multiplayerová vrstva,
PWA/offline, odznaky, admin a tvrdé QA. Plán a pořadí jsou v PLAN.md.

---

## Známá omezení

- **Úložiště API je zatím v paměti.** Rozhraní `Store` je připravené,
  implementace nad Postgresem čeká na přístupové údaje (PLAN.md §6).
  Restart serveru teď smaže žebříčky.
- **Denní odpověď Pětipísmenky** se musí do úložiště dostat přes
  `POST /api/daily/prepare`; cron ve workeru zatím neběží.
- **Realtime server** zatím neexistuje, `/api/rt-ticket` vydává tickety
  „do prázdna".
