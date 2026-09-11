# Průběh

## F0 — Průzkum a plán ✅

**Zjištění.** Repo bylo prázdné — žádné monorepo, žádná auth vrstva, žádné
migrace ani design tokeny. Zadání předpokládá opak, takže podle pravidla
„vyhrává repo" stavíme samostatný projekt (D-001) na doméně vevit.fun (D-002).

**Hotovo.**
- pnpm workspace, TypeScript project references, .gitignore, .editorconfig
- PLAN.md se strukturou, fázemi a 8 riziky
- DECISIONS.md — D-001 až D-012 (mj. `ws` místo Colyseus, vlastní binární kodér,
  Canvas 2D jako výchozí, fixed-point v hodnocených hrách)
- THIRD_PARTY.md — závislosti, písma, datové sady, povinné atribuce
- ops/: docker-compose.yml, Caddyfile, RUNBOOK.md

**Nehotovo / blokované.**
- Přístup na VPS, DNS a Supabase — nemám. Infra je proto zatím jen jako kód.

**Známé odchylky od zadání.** Viz DECISIONS.md D-001, D-002, D-003.
