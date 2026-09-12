# Architektonická rozhodnutí

Formát: ID, kontext, rozhodnutí, důsledky.

---

## D-001 — Samostatné repo místo monorepa

**Kontext.** Zadání popisuje `ve-vit-web-monorepo` s `proxy.ts`, sdílenou auth vrstvou
a Supabase migracemi. Repozitář `VEDRY32/VeVit-fun` byl při zahájení prázdný
(0 commitů, 0 souborů).

**Rozhodnutí.** Stavíme samostatný pnpm workspace v kořeni tohoto repa. Struktura
z promptu (sekce 11) je zachována, jen bez obalového adresáře `games/` — ten by
byl v dedikovaném repu nadbytečný.

**Důsledky.** Integrace s vevit.cz se řeší až při existenci monorepa, přes
adaptér v `apps/api/src/auth/`. Nic v kódu nepředpokládá konkrétní monorepo cesty.

---

## D-002 — Doména vevit.fun, ne vevit.cz/cs/games

**Kontext.** Zadání mluví o `vevit.cz/cs/games` a Vercel rewrite. Uživatel zadal
doménu **www.vevit.fun**.

**Rozhodnutí.** Portál běží na vlastní doméně `vevit.fun`. Vercel rewrite
z hlavního webu tím odpadá; zůstává jako volitelná budoucí varianta.

**Důsledky.** Cookie `__Host-vvsession` se mezi doménami nepřenese. SSO proto
funguje přes **cross-site session bridge**: vevit.cz vydá krátkodobý podepsaný
ticket, vevit.fun ho vymění za vlastní cookie `__Host-vvfsession` (SameSite=Lax,
Secure, HttpOnly). Do doby, než monorepo existuje, běží lokální účty přes stejné
rozhraní — kód auth vrstvy je na zdroji identity nezávislý.
Riziko rewrite → externí origin (přeposílání cookies) tím zaniká.

---

## D-003 — Node 22 místo Node 24

**Kontext.** Zadání předpokládá Node 24; v prostředí je Node 22.22.2.

**Rozhodnutí.** `engines.node: ">=22"`. Nepoužíváme nic, co je jen v Node 24.

**Důsledky.** Docker image `node:22-alpine`; přechod na 24 je jednořádková změna.

---

## D-004 — Auth jako adaptér, ne přímá závislost

**Rozhodnutí.** `apps/api/src/auth/` definuje rozhraní `SessionStore` a
`IdentityProvider`. Implementace: `LocalIdentityProvider` (vlastní účty, Argon2id)
a `VevitSsoProvider` (výměna ticketu z vevit.cz). Volba přes `AUTH_PROVIDER` v `.env`.

**Důsledky.** Vývoj nečeká na SSO. Přepnutí na produkční SSO nemění nic ve hrách
ani v portálu.

---

## D-005 — Realtime: čisté `ws`, ne Colyseus

**Kontext.** Zadání nechává volbu na nás.

**Rozhodnutí.** Vlastní room vrstva nad `ws`.

**Zdůvodnění.**
1. Potřebujeme **binární delta protokol** s viditelností podle zorného pole
   (Buňky.io, Hadi.io). Colyseus má vlastní schema/patch systém, který bychom
   u těchto her stejně obcházeli.
2. **Rollback netcode** u Rvačky vyžaduje kontrolu nad frontou vstupů a
   re-simulací; Colyseus je stavěný na state-sync, ne na lockstep/rollback.
3. Autorizace ticketem a `Origin` kontrola je v `ws` triviální.
4. O ~180 kB menší server a nulová závislost na cizím release cyklu.

**Cena.** Musíme si sami napsat matchmaking, reconnect a room lifecycle —
to je `packages/net` + `apps/realtime/src/rooms/`.

---

## D-006 — Vlastní binární kodér místo msgpack

**Rozhodnutí.** `packages/net/src/codec.ts` — schema-driven kodér nad `DataView`
(u8/u16/i16/f32/varint/string/array/delta-of-previous-state).

**Zdůvodnění.** Herní zprávy mají pevné schéma. Vlastní kodér je pro tento tvar dat
2–4× menší než msgpack a nepotřebuje slovník klíčů v každém rámci. msgpack by dával
smysl u proměnlivých struktur, které tu nemáme.

---

## D-007 — Canvas 2D jako výchozí, PixiJS a Planck.js jen kde je potřeba

**Rozhodnutí.** Jádro enginu je rendererově agnostické (`RenderTarget`), výchozí
implementace Canvas 2D. PixiJS se lazy-loaduje jen u Buňky.io, Hadi.io, Rytmoskok,
Válka panáčků. Planck.js jen u Ježčích dělostřelců, Panáčků: aréna, Magnetky.

**Důsledky.** Většina her má chunk hluboko pod limitem 250 kB gz; těžké závislosti
platí jen ty hry, které je opravdu potřebují.

---

## D-008 — Validace skóre přehráním replaye

**Rozhodnutí.** Deterministické hry posílají `ReplayLog` (seed + komprimované
delta vstupů). Server přehraje headless přes stejný `@vevit-games/rules` modul
a uzná skóre jen při shodě. Nedeterministické hry: sanity limity + statistika.

**Důsledky.** Herní logika **nesmí** sahat na DOM, `Math.random`, `Date.now`.
Vynucuje ESLint pravidlo `no-restricted-globals` + `no-restricted-properties`
v `packages/rules` a `titles/*/logic`.

---

## D-009 — Databáze: Postgres schéma `games`, přístup jen přes API

**Rozhodnutí.** Migrace v `apps/api/migrations/*.sql`, kompatibilní se Supabase
(schéma `games`, `user_id text`, RLS zapnuté a **deny-all** pro `anon`
a `authenticated`; zapisuje jen service role). Odpovědi slovních her jsou
v samostatné tabulce `games.daily_answers` bez jakékoliv grant pro anon role.

**Důsledky.** Klient nikdy nemluví se Supabase přímo. Lokální vývoj používá
tentýž Postgres z Docker Compose.

---

## D-010 — Fixed-point matematika v hodnocených a online hrách

**Rozhodnutí.** `packages/engine/src/math/fixed.ts` — Q16.16 s celočíselnými
operacemi. Povinné v logice her s replay validací nebo online režimem
(Kostkopád, Rvačka, Válka panáčků, Odpal, Běžec, Mávník, Rytmoskok, Cihlobijec).
Ostatní singleplayer hry (Sudoku, Pexeso, Osmisměrka…) jsou diskrétní a float
v nich nehrozí.

---

## D-011 — Písma self-hostovaná, žádné Google Fonts CDN

**Rozhodnutí.** Bricolage Grotesque (OFL), Atkinson Hyperlegible Next (OFL),
Pixelify Sans (OFL) se stahují build skriptem do `apps/portal/public/fonts`
a servírují z vlastní domény.

**Zdůvodnění.** CSP bez cizích originů, GDPR, žádný render-blocking third party.
Fallback stack je definován v tokenech, takže portál je čitelný i bez písem.

---

## D-012 — Názvosloví a IP

**Rozhodnutí.** V celém repu (kód, slugy, URL, testy, commity) se používají
**výhradně** názvy z katalogu zadání. Chráněné názvy originálů se neobjevují
ani v komentářích. Slugy jsou bezdiakritické ASCII varianty českých názvů
(`kostkopad`, `petipismenka`, `hledac-min`).

**Vynuceno.** `scripts/check-ip.mjs` v CI prochází repo na seznam zakázaných
řetězců a selže při nálezu.

---

## D-013 — Pravidla her mají vlastní vstupní body, ne společný barrel

**Kontext.** `@vevit-games/rules` původně re-exportoval všechny hry z jednoho
`index.ts`. Při třetí a páté přidané hře se srazily názvy: `COLS`/`ROWS`/`Cell`
mezi Kostkopádem a Čtyřmi v řadě, pak `FIELD_W`/`FIELD_H` mezi Cihlobijcem
a Invazí. Katalog má mít 57 her, takže další kolize byly jistota.

**Rozhodnutí.** Každá hra má `packages/rules/src/<slug>/index.ts` a importuje
se jako `@vevit-games/rules/<slug>`. Hlavní barrel drží jen to, co je opravdu
společné — `input-bits` a `validate`.

**Důsledky.**
- Hry můžou pojmenovat konstanty přirozeně (`FIELD_W`, `COLS`) bez předpon.
- Import napoví, odkud pravidla pocházejí: `from '@vevit-games/rules/invaze'`.
- Bundler nemusí z barrelu nic ořezávat — titul si stáhne jen svou hru.
- Cena: přibyl jeden soubor na hru a wildcard v `exports`, `paths` i aliasech
  Vite a Vitest.

**Poznámka.** `CTYRI_COLS`/`CTYRI_ROWS` z Čtyř v řadě zůstávají s předponou;
přejmenování zpátky by teď měnilo API bez užitku.

---

## D-014 — Determinismus hlídá skript, ne ESLint pravidlo

**Kontext.** Zadání (sekce 4) žádá ESLint pravidlo, které v herní logice
zakáže `Math.random` a `Date.now`.

**Rozhodnutí.** Stejnou práci dělá `scripts/check-determinism.mjs`, který běží
v `pnpm check` před každým buildem.

**Zdůvodnění.**
1. Vlastní ESLint pravidlo by znamenalo plugin, jeho build a konfiguraci
   flat configu — víc pohyblivých částí než samotná kontrola.
2. Skript rozlišuje **logiku od vykreslování**: `performance.now` je
   v rendereru v pořádku (animace nejsou logika), ale `Math.random` není
   nikde, protože by rozbil i reprodukovatelnost attract ukázek a screenshotů.
   Tohle rozlišení se v ESLintu vyjadřuje hůř než deseti řádky kódu.
3. Výjimky jsou v jednom seznamu **s důvodem**; `eslint-disable` komentáře
   po repu se hůř kontrolují.

**Důsledky.** Editor porušení nezvýrazní za běhu — projeví se až při
`pnpm check`. Kdyby to začalo vadit, pravidlo jde doplnit později; skript
zůstane jako záchranná síť v CI.

**Co skript odhalil hned při zavedení:** Pasiánsy si při stisku ukládaly
`performance.now()` do pole, které se nikdy nečetlo.

## D-015 — Design tokeny: téměř černá, smaragd, oranžová, Inter

**Stav:** přijato

**Kontext:** zadání portálu uvádělo tmavomodrou paletu výslovně jako fallback
(„pokud monorepo obsahuje brand tokeny VeVit, použij je"). Zadavatel dodal
brand tokeny VeVit Games: pozadí `#08090C`, povrch `#111318`, primární
`#10B981`, sekundární `#F97316`, písmo Inter, škála odsazení po 4 px,
rádiusy 6/8/12/16 a specifikace tlačítka, pole a karty.

**Rozhodnutí:** tokeny se přebírají jako závazné. Tmavomodrá paleta
(`#0F1C3F` a spol.) z repa mizí úplně, včetně hardcodovaných hexů ve hrách.

**Důsledky:**
- Zdrojem pravdy pro barvy je `packages/engine/src/render/palette.ts`.
  Leží v enginu, protože hry v `titles/` na `@vevit-games/ui` nezávisí —
  kdyby si paleta žila v UI, hry by si dál psaly vlastní hexy a rozjely by se
  při každé změně tokenů. `@vevit-games/ui` paletu jen přebaluje do tokenů.
- `packages/ui/src/styles/tokens.css` je CSS zrcadlo palety. Shodu obou míst
  a kontrast podle WCAG AA hlídá `packages/ui/src/__tests__/tokeny.test.ts`,
  aby se rozjetí poznalo v CI, ne na produkci.
- Barvy kategorií jsou přeladěné pro téměř černé pozadí a všechny drží
  kontrast ≥ 4,5:1. `textMuted` (`#71717A`) na to nedosahuje (4,1:1), používá
  se proto jen pro velký nebo nepodstatný text — test to drží na AA large.
- Písma Bricolage Grotesque, Atkinson Hyperlegible Next a Pixelify Sans
  nahradilo jediné Inter. Stažená písma klesla z ~300 kB na 133 kB.
- Dvě výjimky z palety jsou v kódu okomentované: Piškvorky kreslí na papír
  a Pasiáns na líc karty, tedy na světlý podklad, na kterém jsou herní
  odstíny (laděné na tmu) nečitelné.

## D-016 — Hry si nechávají vlastní názvy

**Stav:** přijato

**Kontext:** zadání oprav žádá přejmenovat Zdvojku na „2048" a označuje
k přejmenování i Mávníka a Pasiáns (bez uvedení nového názvu).

**Rozhodnutí:** názvy zůstávají. Původní zadání portálu to v sekci
o duševním vlastnictví říká přímo: „V UI, URL, metadatech, SEO ani
viditelném kódu nepoužívej chráněné názvy… **Používej názvy z tohoto
dokumentu**." A ten dokument hru jmenuje Zdvojka; „2048" v něm stojí
jen v závorce jako žánrové vysvětlení pro vývojáře, ne jako název pro UI.
Pravidlo je v zadání označené za nepřekročitelné a hlídá ho
`scripts/check-ip.mjs`, takže mu dávám přednost před pozdějším požadavkem.

**Důsledky:**
- Zdvojka, Mávník i Pasiánsy si drží názvy. U Mávníka a Pasiáns navíc
  zadání nový název neuvádí, takže by nebylo ani na co přejmenovat.
- Číslo 2048 zůstává v kódu tam, kam patří věcně: jako hodnota dlaždice
  a podmínka výhry. Na seznam zakázaných slov proto nepatří.
- Pokud zadavatel na přejmenování trvá, je to jeho rozhodnutí o riziku:
  stačí doplnit nové názvy a upravit `check-ip.mjs`. Do té doby platí
  přísnější varianta.

