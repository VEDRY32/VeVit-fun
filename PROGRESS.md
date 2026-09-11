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

---

## F2 — Ostatní singleplayer 🟡 rozpracováno

### Hotovo

**Mávník** (arkády) — jedno tlačítko, gravitace a mezery mezi stožáry.
Celá logika ve fixed-point, protože hra má denní seed i hodnocený žebříček.
Drak nespadne, dokud hráč poprvé nemávne; mezera se s rostoucím skóre zužuje
ke stropu 120 px. Medaile za 10, 25 a 50 bodů. Paralaxa siluet města.

**Pexeso** (multiplayer a deskovky) — mřížky 4×4 až 8×8, čtyři sady motivů,
vlastní vektorové ilustrace kreslené procedurálně. Model počítá s víc hráči,
takže stejná pravidla obsluhují hru na čas, dva hráče u jednoho zařízení
i budoucí online partii. Kliknutí během prohlížení neshodné dvojice ji hned
zavře, aby hráč nemusel čekat na odpočet.

**Čtyři v řadě** (multiplayer a deskovky) — minimax s alfa-beta ořezáváním
ve třech obtížnostech (hloubka 2, 5 a 7). Lehká občas zahraje náhodně, ale
nikdy nezahodí okamžitou výhru ani nepřehlédne okamžitou prohru. AI přemýšlí
mimo krok logiky, aby se hra viditelně nezasekla. Animace pádu žetonu,
krok zpět vrací proti počítači oba tahy.

### Ověřeno

| Kontrola | Výsledek |
|---|---|
| Unit testy | 278 celkem (nově 60: Mávník 12, Pexeso 15, Čtyři v řadě 21, ostatní) |
| Initial JS portálu | 12,8 kB + React 45,7 kB gzip (limit 130) |
| Největší chunk hry | 21,3 kB gzip (limit 250) |
| Kouřový test | 9 her, desktop i mobil |

### Chyby nalezené a opravené

8. Vzor „plné desky bez čtveřice" v testu remízy čtveřici obsahoval.
   Nahrazen vzorem se třemi žetony na sloupec a obráceným pořadím
   v sousedních sloupcích.
9. Test blokování v AI byl nejednoznačný — pozice dávala AI vlastní výhru
   na stejném sloupci, takže neprokazoval blokování.
10. `COLS`, `ROWS` a `Cell` kolidovaly v barrelu `@vevit-games/rules`
    mezi Kostkopádem a Čtyřmi v řadě.

### Zbývá z F2

Kategorie A: Malované křížovky, Spojovačka, Skladník, Balónky, Osmisměrka, Sudoku.
Kategorie B: Mahjong páskování.
Kategorie C: Hladovec, Invaze, Planetky, Cihlobijec, Přes silnici, Běžec,
Skokan, Obrana města, Trojky, Bublinář, Rytmoskok.
Kategorie D: Rvačka, Válka panáčků, Panáčci: aréna, Ježčí dělostřelci,
Obrana věže, Buchtárna.
Dále: denní výzvy v UI, odznaky, PWA a offline režim.

### F2 — druhá dávka

**Cihlobijec** — spojitá kolize (swept test) místo kontroly překryvu po kroku;
rychlý míček by jinak cihlou prolétl. Míček, který krok začne uvnitř cihly,
se vytlačí po ose s nejmenším průnikem. Šest vylepšení, tři úrovně, laser.

**Invaze** — formace zrychluje, jak nepřátel ubývá; kryty jsou bitmapové masky,
do kterých střela vykousne díru. Tři typy nepřátel rozlišené tvarem.

**Hladovec** — čtyři pronásledovatelé s odlišnou povahou, volba směru přes
vzdálenostní mapu z enginu. Dvě vlastní bludiště, obě ověřená na dosažitelnost
všech polí.

**Běžec** — skok jde dávkovat držením, přikrčení ve vzduchu urychlí pád.
Zároveň slouží jako offline stránka portálu.

**Piškvorky** — neomezená plocha, AI hledá hrozby místo minimaxu. Čtverečkovaný
papír s ručně působícím, ale deterministickým rozkmitáním tahů.

**Odpal** — dva i čtyři hráči, tři obtížnosti AI. Chyba v odhadu se drží po
celou výměnu, ne po jednotlivých krocích.

**PWA a offline** — service worker se třemi strategiemi podle druhu požadavku,
offline stránka je hratelný Běžec jako samostatný vstupní bod.

**Denní výzvy a odznaky** — tři hry denně vybrané z čísla dne, série dní,
17 odznaků vyhodnocovaných čistou funkcí nad statistikami.

### Další chyby nalezené a opravené

11. Vzor „plné desky bez čtveřice" v testu remízy Čtyř v řadě čtveřici
    obsahoval; test blokování navíc dával AI vlastní výhru na stejném sloupci.
12. `COLS`, `ROWS`, `Cell`, později `FIELD_W`/`FIELD_H` kolidovaly v barrelu
    `@vevit-games/rules` → rozděleno na vstupy podle her (D-013).
13. Hladovec: hráč začínal na pevných souřadnicích, které v prvním bludišti
    padly do zdi; druhé bludiště mělo 21 nedostupných polí.
14. Piškvorky: AI upřednostnila blok před vlastní výhrou, protože váha obrany
    přebila dokončení pětice.
15. Odpal: AI losovala chybu v odhadu každý krok, takže se průměrovala k nule
    a i „lehká" obtížnost byla neprůstřelná.
16. Zdvojka počítala mřížku jen ze šířky → poslední řádek mimo plátno.
17. Kontrola velikosti herní plochy v kouřovém testu porovnávala pevnou výšku,
    takže označila správně vykreslený Běžec (640×240) za chybu; teď porovnává
    poměr stran proti manifestu.

### F2 — třetí dávka

**Sudoku** — generátor se symetrickým odebíráním a zárukou jednoznačného
řešení, obtížnost podle nejtěžší nutné techniky. Poznámky tužkou, undo/redo,
nápověda, která vysvětlí použitou techniku a nejdřív opraví špatně zapsané
číslo.

18. `countSudoku`/`countSolutions` nekontrolovala rozpor mezi už vyplněnými
    buňkami — `isValidPlacement` se ptá jen na prázdné, takže řešič
    prohledával celý strom, než došel k nule, a test s rozporuplným
    zadáním neskončil.
19. Ukázka Hada se v hero pruhu 960×540 kreslila na mřížce 12×8, takže
    z hada byl nečitelný zelený válec; mřížka je teď 24×14.

### Stav katalogu

Hotovo 16 z 57 her:
Kostkopád, Pětipísmenka, Zdvojka, Hledač min, Sudoku, Pasiánsy (3 varianty),
Had, Hladovec, Invaze, Cihlobijec, Mávník, Běžec, Pexeso, Čtyři v řadě,
Piškvorky, Odpal.

Zbývá 29 klonů z katalogu a všech 12 originálů VeVit.
