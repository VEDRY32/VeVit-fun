# Kuličkodráha — návrh

Datum: 12. 9. 2026

## 1. Cíl

Nová arkádová hra: nekonečný běh kuličky po procedurálně generované,
místy děravé dráze v pseudo-3D pohledu (kamera za kuličkou, dráha mizí
do dálky). Hráč řídí do stran a skáče přes mezery. Skóre roste
s uraženou vzdáleností, dráha postupně zrychluje a houstne.

**Mechanika a technika projekce je převzatá z veřejně publikovaného
JS1024 dema „Skydreams" (Frank Force, 2026).** Uživatel byl upozorněn,
že projekt má v `THIRD_PARTY.md` pravidlo „žádný cizí kód/asset bez
ověřené licence" a `scripts/check-ip.mjs` hlídá jen chráněné názvy her
(ne provenienci kódu) — nikoliv obecnou licenční kontrolu. Uživatel
riziko vědomě přijal. Zapisuje se jako nová položka v `DECISIONS.md`
(D-019) a řádek v `THIRD_PARTY.md`.

## 2. Architektura (podle konvence projektu)

- `packages/rules/src/kulickodraha/game.ts` — čistá herní logika,
  žádný DOM, žádná náhoda mimo seed (D-008). Vzor: `rules/utek/game.ts`
  (běžné číslo s desetinnou čárkou, ne fixed-point — originál používá
  `Math.cos` pro perspektivu a fixed-point by to jen zkomplikoval;
  `check-determinism.mjs` vyžaduje jen absenci `Math.random`/`Date.now`,
  ne fixed-point).
- `packages/rules/src/kulickodraha/index.ts` — re-export.
- `packages/rules/src/kulickodraha/__tests__/game.test.ts` — testy.
- `titles/kulickodraha/src/manifest.ts` — metadata pro katalog.
- `titles/kulickodraha/src/render.ts` — vykreslení (projekce, dráha,
  obloha, kulička, `renderAttract` pro dlaždici katalogu).
- `titles/kulickodraha/src/index.ts` — `mount()`, napojení na
  `createLoop`/`createSurface`/`ctx.input`/`ctx.audio`/`ctx.scores`.
- Registrace v `apps/portal/src/lib/catalog.ts` (import manifestu +
  lazy `load()`).

## 3. Stav a krok logiky

```ts
interface KulickodrahaState {
  x: number;          // pozice na dráze (0–7 = sloupce, plynule)
  y: number;           // výška nad drahou (0 = na zemi)
  vy: number;          // svislá rychlost
  z: number;           // ujetá vzdálenost (roste každým krokem)
  speed: number;       // aktuální rychlost, roste do stropu
  trackGap: number;    // odpočet do další celoplošné mezery
  trackSx: number;     // levý okraj aktuálního „pruhu" dráhy
  trackSw: number;     // šířka aktuálního pruhu
  rows: boolean[][];   // vygenerované řádky dráhy (dlaždice 0/1 na sloupec)
  score: number;
  tick: number;
  started: boolean;
  over: boolean;
  previousMask: number;
}
```

`step(mask)` každý tik (60 Hz):
1. Řízení do stran: `left`/`right` drženo → `x -= 0.1` / `x += 0.1`
   (přesně `ENHANCED` klávesová větev originálu), ořez na šířku dráhy.
2. Skok: `justPressed(a)` na zemi nastaví `vy` na startovní hodnotu;
   držení `a` ve vzduchu přidává impuls (originál: `mouseDown`), max.
   originálem daný počet ticků/výška.
3. Gravitace stáhne `y`/`vy`; pokud je pod dráhou a dlaždice pod
   kuličkou existuje, přistání vynuluje `y`, jinak kulička padá dál.
4. `z += speed`, `speed` roste ke stropu (stejné vzorce jako originál).
5. Generování nových řádků dráhy „na dohled" pomocí `ctx.rng` (seedovaný
   `createRng`, ne `Math.random`) — přenos náhodných rozhodnutí
   (mezera/sloupec/díra) beze změny algoritmu.
6. Pokud kulička spadne (`y` pod práh, originál `-4`) → `state.over = true`.
7. `score = Math.floor(z / konstanta)`.

## 4. Vstup a ovládání

- `left`/`right` (šipky, A/D) — plynulý pohyb do stran, žádná analogová
  poloha myši (viz odsouhlasené rozhodnutí — replay nese jen bitovou
  masku akcí).
- `a` (mezerník/tap) — skok, držení prodlužuje výšku.
- Dotykové ovládání: dvě neviditelné zóny vlevo/vpravo pro směr (jako
  `bezec`/`utek` používají zóny místo viditelných tlačítek) + tap
  kdekoliv jinde = skok. Přesné rozložení dolaďu při implementaci podle
  `touchButtons` konvence ostatních titulů.

## 5. Režimy

- **Klasik** (`klasik`) — nekonečná dráha, seed z `ctx.seed`
  (per-run), skóre = vzdálenost, `ranked: true`, `scoring: 'high'`.
- **Denní výzva** (`denni`) — stejná logika, seed odvozený ze dne
  (portál už to řeší obecně přes `dailySeed()` — hra dostane seed přes
  `ctx.seed`, žádná speciální logika v `game.ts` navíc).

## 6. Vykreslování

- Zachovává techniku originálu: promítání bodů dráhy do 2D přes
  perspektivní vzorec (`P(x, y, dz)`), dlaždice se kreslí odzadu
  dopředu, barva podle vzdálenosti od kamery.
- Barvy jdou přes `theme.accent`/`theme.background`/kategorii, ne přes
  natvrdo zapsané `hsl(170+i/9+z...)` z originálu — přepočet do
  vlastní palety (odstín podle vzdálenosti zůstává, výchozí odstín je
  z tématu hry).
- Hvězdné pozadí a obloha zůstávají (čistě procedurální, žádný asset).
- `renderAttract` — smyčka kamery letící dráhou bez hráče, pro dlaždici
  katalogu (vzor: ostatní `renderAttract` implementace).

## 7. Testování

- `packages/rules/src/kulickodraha/__tests__/game.test.ts`:
  - determinismus: stejný seed + stejné vstupy → stejný průběh
    (vzor z `bezec`/`utek` testů).
  - hráč spadne do mezery bez skoku → `over` do pár ticků.
  - držení skoku dá vyšší/delší skok než ťuknutí.
  - řízení do stran respektuje okraje dráhy (nejde vyjet úplně mimo).
  - skóre roste monotónně, dokud hra neskončí.
- `pnpm check` (IP + determinismus) a `pnpm typecheck` musí projít.
- Ruční smoke test v prohlížeči (desktop + touch overlay).

## 8. Dokumentace

- `THIRD_PARTY.md`: nový řádek u „Vlastní obsah" nebo nová sekce
  „Přejatá mechanika" — algoritmus pseudo-3D dráhy a fyzika skoku z
  demoscene dema Skydreams (Frank Force, JS1024 2026), licence
  neověřena, použito na výslovné riziko zadavatele.
- `DECISIONS.md`: D-019 zaznamenává tuto výjimku z pravidla „žádný
  cizí kód" a proč.
- `docs/PROGRESS.md` / katalogová zpráva podle zvyklosti projektu
  (volitelné, podle toho, jak se vedou předchozí zápisy — viz
  `ZPRAVA-NOVE-HRY.md` jako precedent).
