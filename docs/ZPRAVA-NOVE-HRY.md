# Zpráva: jedenáct nových her ve stylu flashové éry

Datum: 12. 9. 2026 · větev `claude/stoic-meitner-2lxs9m`

Zadání: přidat jedenáct her inspirovaných starými flashovými klasikami,
využít existující architekturu, design systém a komponenty, nekopírovat
cizí assety a projít kontrolou kvality.

---

## 1. Co přibylo

| Hra | Kategorie | Žánr | Ovládání | Testů |
|---|---|---|---|---|
| **Oheň a Voda** | Hraj s ostatními | kooperativní plošinovka pro dva | šipky + WASD | 12 |
| **Kostka** | Logika | tahový hlavolam s převalováním kvádru | šipky, klik | 19 |
| **Šťastná opice** | Logika | klikací hlavolam ve čtyřech scénách | myš, šipky | 11 |
| **Lovec území** | Arkády | zabírání plochy obkreslováním | šipky | 8 |
| **Průchody** | Logika | fyzikální hlavolam s hybností | myš, mezerník | 14 |
| **Super skokan** | Arkády | plošinovka se skákáním a dupáním | šipky, mezerník | 16 |
| **Nájezdník** | Akce | plošinovka se střelbou | šipky, mezerník | 14 |
| **Útěk** | Arkády | nekonečný běh třemi pruhy | šipky, mezerník | 10 |
| **Poslední obrana** | Akce | obrana barikády, míření myší | myš, 1–3 | 11 |
| **Pouliční bitka** | Akce | mlátička z boku s hloubkou ulice | šipky, mezerník, K | 10 |
| **Panáčci** | Akce | strategie na jedné linii, tři obtížnosti | klik, 1–4 | 13 |

Celkem 138 nových testů pravidel. Katalog vzrostl z 16 na 27 her.

---

## 2. Názvy: tři jsem změnil

Tři pracovní názvy ze zadání se opírají o cizí značky, a původní zadání
portálu má zákaz chráněných názvů označený za nepřekročitelný:

| Zadání | Název v portálu | Proč |
|---|---|---|
| Portály | **Průchody** | Portal je zapsaná známka Valve |
| Vetřelec | **Nájezdník** | český název filmové série Alien |
| Stick Armies | **Panáčci** | blízko Stick War, které je přímo na seznamu zakázaných názvů |

Zbylých osm názvů zůstalo beze změny — obecná česká slova žádnou známku
neporušují. Mechanika ani pocit ze hry se změnou jména nemění. Zapsáno
jako D-017 v `DECISIONS.md`.

---

## 3. Co pro ně bylo potřeba dostavět

Zadání říkalo využít existující architekturu. Dvě věci v ní chyběly a
vznikly tak, aby je mohly používat i budoucí hry:

### Sdílená plošinovková fyzika (`packages/rules/src/platform`)

Čtyři nové hry jsou z boku, s gravitací a dlaždicovou mapou. Kdyby si každá
psala vlastní kolize, rozejdou se v detailech, které hráč cítí: jak vysoko
se doskočí, jestli se dá klouzat po stěně, jestli postava projde rohem.

Modul řeší osy odděleně a posun po ose dělí na kroky nejvýš o velikosti
dlaždice. Obojí je nutné: kdyby se posun vyhodnotil najednou, postava by se
u rohu zasekla nebo skrz dlaždici proklouzla podle toho, která složka
rychlosti je zrovna větší. Deset testů drží gravitaci, dopad, náraz do
stěny i do stropu a prorážení podlahy při vysoké rychlosti.

Super skokan k tomu přidal dvě věci, které dělí plošinovku od „tvrdé":
**coyote time** (skok jde ještě pár snímků po odstoupení z hrany)
a **buffer skoku** (stisk těsně před dopadem se provede po dopadu). Obojí
má vlastní test.

### Druhý hráč v kontraktu hry (`GameContext.input2`)

Oheň a Voda je pro dva na jedné klávesnici. Vstup podle architektury patří
portálu, ne hře — jen tak funguje přemapování kláves, dotykový overlay
a nulování stavu při pauze. Kontrakt proto dostal druhý volitelný vstup,
který portál vytvoří jen u her hlásících v manifestu lokální hru dvou
hráčů. Do replaye jdou obě masky v jedné: první hráč ve spodních šestnácti
bitech, druhý v horních.

---

## 4. Co při stavbě vyšlo najevo

Nové hry odhalily dvě chyby, které se týkaly celého portálu:

**Krátký stisk se ztrácel.** Při hraní Kostky v prohlížeči se ze tří
rychlých stisků šipky do hry dostal jeden. Logika se vzorkuje šedesátkrát
za sekundu, ale klávesa může trvat kratší dobu než jeden krok — a takový
stisk se do vzorku vůbec nedostal. Správce vstupu si teď stisky mezi vzorky
pamatuje. Je to nejspíš i příčina staršího hlášení „Had občas nereaguje na
šipky".

**Dvě hry splynuly s nepřáteli.** Poslední obrana i Pouliční bitka braly
barvu hráče z kategorie, a ta je u akčních her červená — stejná jako
nepřátelé. Obě mají nově vlastní barvu hráče.

Kromě toho testy odhalily chyby v datech dřív, než se dostaly ke hráči:
solver Kostky hned při psaní ukázal, že dvě ze šesti úrovní nejdou dohrát
a u jedné je slíbený počet tahů nesplnitelný. Kontroly tvaru úrovní
zachytily pět různě dlouhých řádků.

---

## 5. Vlastní obsah

Žádná hra nepoužívá cizí grafiku, zvuky, úrovně ani postavy. Všechno se
kreslí procedurálně na plátno z palety portálu:

- **Oheň a Voda** — dvě kapky, ohnivá špičkou nahoru, vodní dolů. Kaluže
  se vlní podle vzorce, ne podle obrázku.
- **Kostka** — kvádr s bočnicí a stínem, dlaždice s tloušťkou, křehké
  s prasklinou, most jako čárkovaný obrys, když je vypnutý.
- **Šťastná opice** — čtyři kreslená pozadí (les, jeskyně, pobřeží, domek)
  a opice, které se podle nálady mění úsměv.
- **Lovec území** — zabraná plocha s jemnou texturou, dva druhy nepřátel
  lišící se tvarem, ne jen barvou.
- **Průchody** — ústí jako pulzující elipsa na hraně dlaždice, kov
  šrafovaný, aby bylo poznat, že na něj průchod nejde.
- **Super skokan, Nájezdník** — postavičky s hlavou, nohama v běhu
  a zbraní ve směru pohledu.
- **Útěk** — pronásledovatel jako tmavá vlna zleva, jejíž okraj se vlní.
- **Poslední obrana** — tři siluety nepřátel, ukazatel zahřátí pod lodí.
- **Pouliční bitka** — fasáda s okny, vozovka s dělicími čarami,
  stín pod nohama jako jediné vodítko, kdo stojí v jaké hloubce.
- **Panáčci** — panáčci z čar, každý druh s jiným nástrojem (krumpáč, meč,
  luk, štít), aby se poznali i v hromadě.

Zvuk je ZzFX z enginu, žádné nahrávky.

---

## 6. Kontrola kvality

| Kontrola | Výsledek |
|---|---|
| Testy | 736 prošlo (44 souborů) |
| TypeScript | 7 projektů bez chyby |
| Kontrola duševního vlastnictví | prošla |
| Kontrola determinismu | prošla, 1 zdůvodněná výjimka |
| Kouřový test v prohlížeči | 27 her × desktop i mobil, 0 chyb v konzoli |

Každá nová hra:

- má manifest s poměrem stran, který kouřový test ověřuje proti skutečné
  velikosti herní plochy,
- kreslí ukázku do dlaždice v katalogu (`renderAttract`),
- hlásí portálu skóre, konec a pauzu přes `GameContext`,
- má nápovědu ovládání a — kde to dává smysl — dotykový overlay,
- je vlastní chunk, který se stahuje až při spuštění.

**Co za pozornost stojí — serverová validace skóre.** Server umí přehrát
replay zatím jen u Kostkopádu (`packages/rules/src/validate.ts`); u všech
ostatních her, starých i nových, vrací validace `unsupported`. Nové hry to
tedy nezhoršují, ale ani neposouvají.

Osm z jedenácti nových her je deterministických a ovládaných klávesnicí,
takže by šlo přehrát: Kostka, Lovec území, Super skokan, Útěk, Nájezdník,
Oheň a Voda, Panáčci a Šťastná opice. Chybí jim jen headless smyčka ve
validátoru — to je práce na jednu hru zvlášť a do zadání nepatřila.

Tři hry to mít nebudou bez změny formátu replaye: Poslední obrana míří
myší, Průchody pokládají průchody klikem a Pouliční bitka má myš jako
alternativu. Replay zaznamenává jen bitovou masku akcí, ne polohu
ukazatele. Rozšířit formát je zásah do něčeho sdíleného a nechávám ho na
rozhodnutí, jestli se do toho má jít — stejné omezení má i starší
Cihlobijec.
