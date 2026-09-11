# VeVit Games — plán (F0)

Stav: F0 dokončeno. Tento dokument je závazný plán pro fáze F1–F5.

## 1. Výchozí stav (zjištěno průzkumem)

Repozitář `VEDRY32/VeVit-fun` byl při zahájení **zcela prázdný** — žádné commity,
žádný monorepo kód, žádná `proxy.ts`, auth vrstva, design tokeny ani Supabase migrace.
Zadání (sekce 1 promptu) předpokládá existující monorepo `ve-vit-web-monorepo`.
Podle pravidla „kde se dokument liší od repa, vyhrává repo" stavíme **samostatný
projekt v kořeni tohoto repa**. Všechny odvozené odchylky jsou v `DECISIONS.md`
(D-001 až D-012).

Doména je podle zadání uživatele **www.vevit.fun** (ne `vevit.cz/cs/games`).
Portál je proto navržen jako samostatná doména s vlastní cestou `/(cs|en)/<slug>`,
ale integrace s VeVit SSO zůstává připravená přes adaptér (viz D-004).

## 2. Struktura

```
apps/
  portal/     React + Vite shell portálu (SPA s route-level code splittingem)
  api/        Fastify + TypeScript (skóre, denní výzvy, tickety, admin)
  realtime/   Node + ws, vlastní vrstva místností, binární protokol
  worker/     cron: denní výzvy, přepočty žebříčků, slovníky, zálohy
packages/
  engine/     herní smyčka, vstup, audio, render utility, RNG, storage
  rules/      čistá deterministická herní logika (sdílí klient i server)
  ui/         komponenty portálu + design tokeny
  net/        protokol a klient pro realtime
titles/
  <slug>/     manifest.ts, index.ts, logic/, render/, data/
ops/
  docker-compose.yml, Caddyfile, RUNBOOK.md
```

Balíčky jsou pnpm workspace, TypeScript project references, build přes `tsc`
(packages) a Vite (portal).

## 3. Klíčová technická rozhodnutí

| Téma | Rozhodnutí | Kde |
|---|---|---|
| Realtime server | čisté `ws` + vlastní room vrstva | D-005 |
| Binární protokol | vlastní kompaktní kodér (bez msgpack závislosti) | D-006 |
| Render | Canvas 2D výchozí; PixiJS jen u her s tisíci objekty | D-007 |
| Fyzika | vlastní (Verlet/impuls); Planck.js jen u Dělostřelců a Arény | D-007 |
| RNG | sfc32 ze seedu, zákaz `Math.random` v herní logice (ESLint) | engine |
| Validace skóre | replay vstupů → headless přehrání v `@vevit-games/rules` | D-008 |
| Auth | opaque session token, cookie `__Host-vvsession`, adaptér pro VeVit SSO | D-004 |
| DB | Postgres schéma `games`, zapisuje jen API se service rolí | D-009 |

## 4. Fázový plán

### F1 — Základ a vlajkové singleplayer hry
- [x] `@vevit-games/engine` — smyčka, RNG, vstup, audio, storage, škálování, utility
- [x] `@vevit-games/rules` — deterministická logika + replay validátor
- [x] `@vevit-games/ui` — tokeny, GameTile, CategoryShelf, PauseOverlay, ResultScreen, Leaderboard
- [x] portál: domů, kategorie, stránka hry, hledání, nastavení, profil
- [x] API: runs/start, runs/submit, leaderboards, daily, auth session
- [x] schéma `games` (SQL migrace) + RLS
- [x] hry: Kostkopád, Pětipísmenka, Zdvojka, Had, Hledač min, Pasiánsy, Přihořívá

### F2 — Ostatní singleplayer
Zbytek kategorií A–D bez online režimů, denní výzvy, odznaky, PWA/offline.

### F3 — Multiplayer
Realtime server, tickety, lobby, matchmaking, Glicko-2 rating, boti, moderace.

### F4 — Originály VeVit
Pořadí O7, O8, O1, O12, O5, O4, O2, O3, O6, O11, O9, O10 — vždy prototyp → ověření → obsah.

### F5 — QA a předání
Výkon, přístupnost, bezpečnost, zátěžový test, zálohy, RUNBOOK, úklid.

## 5. Rizika

| # | Riziko | Dopad | Mitigace |
|---|---|---|---|
| R1 | Rozsah 57 her je násobně větší než jedna iterace | vysoký | přísné fázování, sdílený engine, šablona hry, PROGRESS.md eviduje stav každé hry |
| R2 | Determinismus napříč prohlížeči (float) | vysoký | fixed-point matematika v logice hodnocených a online her |
| R3 | CSP bez `wasm-unsafe-eval` vyřadí WASM (šachy) | střední | per-route CSP, šachový worker jen na `/cs/sachy` |
| R4 | Licence slovníků a datových sad | střední | THIRD_PARTY.md, vlastní generované sady jako výchozí |
| R5 | VPS nedostupné v této session | střední | infra jako kód (compose + Caddy + RUNBOOK), deploy až s přístupem |
| R6 | Cheating v žebříčcích | střední | replay validace, rate limit, sanity limity, admin flag |
| R7 | Velikost chunků (engine + hra ≤ 250 kB gz) | střední | code splitting per hra, žádné těžké závislosti v jádru |
| R8 | Moderace obsahu (chat, kresby, úrovně) | střední | veřejné místnosti jen rychlé zprávy, reporty, vote-kick |

## 6. Chybějící přístupy (blokuje nasazení, ne vývoj)

- VPS (SSH, IP, doména `vevit.fun` DNS) — **nemám**
- Supabase projekt (URL, service role key) — **nemám**
- Vercel konfigurace hlavního webu — **nemám** a podle D-002 není potřeba

Dokud přístupy nejsou, vše běží lokálně: API s SQLite-kompatibilní vrstvou nebo
Postgres z Docker Compose, portál z Vite dev serveru.
