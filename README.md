# VeVit Games

Herní portál **vevit.fun** — 45 her inspirovaných klasickými prohlížečovkami
a 12 originálních her VeVit. Vlastní engine, vlastní grafika, žádné cizí assety.

## Rychlý start

```bash
pnpm install
pnpm dev          # portál na http://localhost:5173
pnpm dev:api      # API na http://localhost:3001
pnpm test         # Vitest
pnpm typecheck
```

## Struktura

| Cesta | Co to je |
|---|---|
| `apps/portal` | React shell portálu (Vite) |
| `apps/api` | Fastify API — skóre, denní výzvy, tickety, admin |
| `apps/realtime` | WebSocket server pro multiplayer |
| `apps/worker` | cron: denní výzvy, přepočty, slovníky, zálohy |
| `packages/engine` | herní smyčka, vstup, audio, RNG, render utility |
| `packages/rules` | čistá deterministická logika sdílená klientem a serverem |
| `packages/rules/platform` | plošinovková fyzika sdílená hrami z boku |
| `packages/ui` | komponenty portálu a design tokeny |
| `packages/net` | binární protokol a klient pro realtime |
| `titles/<slug>` | jednotlivé hry |
| `ops/` | Docker Compose, Caddy, RUNBOOK |

## Dokumenty

- [PLAN.md](PLAN.md) — struktura, fáze, rizika
- [DECISIONS.md](DECISIONS.md) — architektonická rozhodnutí (D-001…)
- [PROGRESS.md](PROGRESS.md) — co je hotové a co ne
- [THIRD_PARTY.md](THIRD_PARTY.md) — licence třetích stran
- [ops/RUNBOOK.md](ops/RUNBOOK.md) — provoz
- [docs/NASAZENI-VERCEL.md](docs/NASAZENI-VERCEL.md) — portál na Vercelu (statické nasazení bez API)
- [docs/ZPRAVA-OPRAVY.md](docs/ZPRAVA-OPRAVY.md) — velká vlna oprav: příčiny a co se z nich opravilo
- [docs/ZPRAVA-NOVE-HRY.md](docs/ZPRAVA-NOVE-HRY.md) — jedenáct her ve stylu flashové éry

## Pravidla, která se neporušují

1. **Duševní vlastnictví.** Žádné chráněné názvy, postavy ani assety originálů.
   Kontroluje `scripts/check-ip.mjs` v CI.
2. **Determinismus.** V herní logice žádné `Math.random` ani `Date.now` —
   jen `ctx.rng` a herní čas. Vynuceno ESLintem.
3. **Server nevěří klientovi.** Skóre se ověřuje přehráním replaye, odpovědi
   slovních her klient nikdy nedostane.
