# Nasazení na Vercel

Na Vercel jde **portál** — statický web s hrami. API, realtime a worker tam
neběží; co to znamená pro hráče, je níž v „Co na Vercelu chybí".

## Nastavení projektu

Naimportuj repozitář ve Vercelu a nech všechno na výchozích hodnotách.
Zbytek si řekne `vercel.json` v kořeni:

> **Root Directory musí zůstat kořen repa.** Vercel čte `vercel.json` právě
> z něj. Když se při importu vybere podadresář (třeba `apps/api`, který
> Vercel v monorepu rád nabídne sám), kořenový `vercel.json` se přeskočí
> a nasazení spadne — viz „Když build spadne" níž.

| Volba | Hodnota | Proč |
|---|---|---|
| Root Directory | `.` (kořen repa) | `vercel.json` počítá cesty od kořene; podadresář by build rozbil |
| Framework Preset | Other | monorepo s vlastním buildem, ne detekovaný Vite v kořeni |
| Install Command | `pnpm install --frozen-lockfile` | z `vercel.json` |
| Build Command | `pnpm --filter @vevit-games/portal build` | z `vercel.json` |
| Output Directory | `apps/portal/dist` | z `vercel.json` |

Verzi pnpm si Vercel vezme z `packageManager` v kořenovém `package.json`,
verzi Node z `engines.node` (>= 22). Žádné proměnné prostředí nejsou potřeba —
portál si adresu API drží natvrdo jako `/api`.

## Co dělá `vercel.json`

**Přepis na `index.html`.** Portál si cesty řeší sám (`/cs/had`,
`/cs/kategorie/arkady`, `/cs/nastaveni`), server o nich nic neví. Bez přepisu
by přímé otevření odkazu nebo obnovení stránky skončilo na 404. Statické
soubory se hledají dřív než přepisy, takže `/assets/*`, `/fonts/*`, `sw.js`
ani `offline.html` tím neproteče.

**`/api` je z přepisu vynechané schválně.** Má vrátit 404, ne stránku portálu.
Klient v `apps/portal/src/lib/api.ts` si s tím poradí: každý požadavek má
časový limit 6 s a při jakékoliv chybě spadne do lokálního režimu.

**Hlavičky.** Assety mají v názvu obsahový hash, takže se cachují napořád.
`sw.js` a `offline.html` se naopak nesmí cachovat — service worker by po
nasazení dál řídil starou verzi portálu.

## Co na Vercelu chybí

Bez API běží portál v lokálním režimu. Hry fungují všechny, ale:

- **Skóre zůstává v prohlížeči.** Rekordy se ukládají lokálně, online
  žebříčky jsou prázdné.
- **Seed si losuje klient.** Běhy se neověřují přehráním replaye, takže
  hodnocené režimy nemají smysl brát jako soutěžní.
- **Denní výzva funguje**, protože její seed se odvozuje z data, ne ze serveru.
- **Multiplayer nefunguje** — potřebuje `apps/realtime`.
- **Slovní hry prozradí odpovědi**, protože kontrolu jinak dělá server.

Až bude API kde hostovat, stačí do `vercel.json` přidat přepis `/api/(.*)` na
jeho adresu a vynechávka v přepisu na `index.html` se postará o zbytek.
Kompletní provoz se vším všudy popisuje [ops/RUNBOOK.md](../ops/RUNBOOK.md).

## Když build spadne

### `No Output Directory named "dist" found after the Build completed`

Build proběhl, ale Vercel hledá výstup jinde, než kam vede `vercel.json` —
skoro vždycky proto, že **Root Directory ukazuje do podadresáře**, takže se
kořenový `vercel.json` vůbec nenačetl a `outputDirectory` spadlo na výchozí
`dist`.

Poznat to jde z instalační části logu. Vypsané závislosti patří tomu projektu,
ve kterém Vercel stojí:

```
+ @vevit-games/engine 0.1.0 <- ../../packages/engine
+ @vevit-games/rules 0.1.0 <- ../../packages/rules
+ fastify 5.12.4
```

`fastify` má z celého repa jenom `apps/api` — tohle je tedy `apps/api`, ne
kořen. Portál by na jeho místě vypsal `react`, `react-dom` a `@vevit-games/ui`.
Napovídá i prefix `../..` u průběhu instalace: pnpm běží dva adresáře hluboko.

Náprava v Project Settings → Build & Deployment:

1. **Root Directory** vyprázdnit (kořen repa).
2. Zrušit ruční přepisy u **Build Command**, **Install Command** i **Output
   Directory** — všechno tři si řekne `vercel.json`. Dokud v dashboardu něco
   přebývá, není jasné, co vlastně platí.

Root Directory na `apps/portal` **nestačí**: build by prošel, ale bez
`vercel.json` by chyběly přepisy cest a přímé otevření `/cs/had` by skončilo
na 404. Kdyby to někdy bylo potřeba, musí se `vercel.json` přesunout tam.

## Ověření po nasazení

```bash
BASE_URL=https://<tvoje-adresa> pnpm smoke
```

Projede v prohlížeči domovskou stránku, offline stránku i každou hru a selže
na jakékoliv chybě v konzoli.
