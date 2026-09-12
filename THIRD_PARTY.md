# Licence třetích stran

Pravidlo: **žádná NC (nekomerční) licence**, žádné cizí assety, každá položka
ověřená před použitím. GPL jen jako izolovaný worker s atribucí.

## Běhové závislosti

| Komponenta | Verze | Licence | Použití | Poznámka |
|---|---|---|---|---|
| React | ^18 | MIT | shell portálu | |
| React DOM | ^18 | MIT | shell portálu | |
| Vite | ^6 | MIT | build | dev závislost |
| TypeScript | ^5.7 | Apache-2.0 | build | dev závislost |
| Vitest | ^2 | MIT | testy | dev závislost |
| happy-dom | ^20 | MIT | DOM v testech vstupu | dev závislost |
| Fastify | ^5 | MIT | API | |
| ws | ^8 | MIT | realtime | |
| PixiJS | ^8 | MIT | render jen u vybraných her | lazy chunk |
| Planck.js | ^1 | MIT | fyzika jen u vybraných her | lazy chunk |
| chess.js | ^1 | BSD-2-Clause | pravidla šachu | F3 |
| Stockfish (WASM) | 16 | **GPL-3.0** | šachová AI | izolovaný worker, atribuce na stránce hry, odkaz na zdroj |

## Zvuk a hudba

| Komponenta | Licence | Poznámka |
|---|---|---|
| ZzFX (algoritmus) | MIT | vlastní TypeScript reimplementace v `packages/engine/src/audio/zzfx.ts` |
| Hudba | vlastní | procedurální sekvencer, skladby jsou data v repu |

## Písma

| Písmo | Licence | Použití |
|---|---|---|
| Inter | OFL 1.1 | veškerý text portálu (řezy 400–800) |

Self-hostované (D-011), staženo skriptem `scripts/fetch-fonts.mjs` do
`apps/portal/public/fonts` (133 kB celkem, jen podmnožiny latin a latin-ext).
OFL vyžaduje šíření licence spolu s písmem — texty licencí leží vedle souborů
jako `OFL-*.txt` a servírují se ze stejné domény.

## Datové sady

| Sada | Licence | Stav | Použití |
|---|---|---|---|
| České slovníky pro Pětipísmenku | vlastní, ručně kurátorované | připraveno v `apps/worker/scripts/wordlists` | odpovědi + povolené pokusy |
| fastText `cc.cs.300` | CC BY-SA 3.0 | **plánováno F1/F2** | Přihořívá — vektory; atribuce povinná na stránce hry |
| Lichess puzzle DB | CC0 | plánováno F3 | denní šachová úloha |
| Texty pro Psaní na rychlost | public domain (autor † 70+ let) | plánováno F3 | Čapek, Němcová |

### Atribuce vyžadované ve zveřejněném UI

- **Přihořívá** — „Slovní vektory: fastText (Facebook AI Research), CC BY-SA 3.0."
  Odvozená data (předpočítané pořadí) se tím šíří pod stejnou licencí — uvedeno
  v patičce hry.
- **Šachy** — „Šachový engine: Stockfish, GPL-3.0" + odkaz na zdrojový kód.

## Vlastní obsah (žádná třetí strana)

Veškerá grafika, sprity, úrovně, motivy nonogramů, sady pexesa, postavy Rvačky,
zvuky a hudba jsou vytvořené v tomto repu procedurálně nebo jako data. Žádný
asset nepochází z cizí hry.
