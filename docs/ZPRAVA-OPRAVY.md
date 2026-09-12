# Zpráva o opravách VeVit Games

Datum: 12. 9. 2026 · větev `claude/stoic-meitner-2lxs9m`

Zadání znělo: nejdřív pochopit architekturu, pak hledat skutečné příčiny,
neopravovat symptomy, nezdvojovat logiku a zabránit návratu chyb. Zpráva je
proto řazená podle příčin, ne podle her — většina hlášených chyb měla společný
původ a napravit je po jedné by znamenalo napsat tu samou záplatu šestkrát.

---

## 1. Jak jsem postupoval

1. Přečetl jsem vrstvy, které hry sdílejí: herní smyčka, správce vstupu,
   zvuková sběrnice, stránka hry v portálu, kontrakt `GameModule`.
2. Hlášené chyby jsem promítl do těchto vrstev a hledal, která z nich by
   dokázala způsobit víc hlášení najednou.
3. Teprve co nešlo vysvětlit sdílenou vrstvou, jsem hledal v pravidlech
   jednotlivých her.
4. Na každou nalezenou příčinu jsem napsal test, který by ji zachytil.
   Testů je 575, z toho 69 nových.

Co se ověřovalo u každé změny: `pnpm check` (duševní vlastnictví
a determinismus), `pnpm typecheck` (7 projektů), `vitest run`
a kouřový test v prohlížeči (16 her × desktop i mobil, nulová tolerance
na chyby v konzoli).

---

## 2. Sdílené příčiny

### 2.1 Myš nefungovala v půlce katalogu

**Hlášeno u:** Sudoku (kliknutí na buňky a tlačítka), Hledač min,
Čtyři v řadě (vhození žetonu klikem), Piškvorky, Pětipísmenka
(klikání na virtuální klávesnici).

**Příčina:** správce vstupu zajížděl ukazatel (`setPointerCapture`) na
hostitelský `div` hry. Zajetí podle specifikace přesměruje všechny další
události o ukazateli na zajímající element — plátno, které leží uvnitř, už
`pointerup` nikdy nedostane. A přesně na plátno si tyhle hry svoje
posluchače věší. Události `pointerdown` procházely (zajetí vzniká až po
nich), takže hry ovládané stiskem fungovaly a hry ovládané puštěním ne.
To odpovídá tomu, které hry byly nahlášené.

**Oprava:** zajetí je pryč. Tažení mimo plochu drží `pointermove`
a `pointerup` na okně, což na stejnou práci stačí.

**Test:** `packages/engine/src/__tests__/input.test.ts` — plátno vložené do
cílového elementu musí kliknutí dostat a `setPointerCapture` se nesmí volat.

### 2.2 Hra dostávala tahy, o které si hráč neřekl

**Hlášeno u:** „náhodné" zvuky a akce v Hledači min, odkryté pole po
návratu z pauzy.

**Příčina:** `pointerup` se poslouchá na okně, aby tažení nezůstalo viset.
Počítalo se ale jako tah i tehdy, když stisk začal mimo herní plochu —
například kliknutím na tlačítko v překryvu pauzy. Souřadnice se přepočetly
do herního prostoru a hra dostala tah na náhodném místě.

**Oprava:** stisk se páruje s puštěním; puštění bez stisku na ploše se
zahodí. Navíc má `InputManager` novou metodu `reset()`, kterou portál volá
při pauze, pokračování i restartu — stisk, který padl mimo běžící smyčku,
se jinak odbavil až v prvním kroku po návratu.

### 2.3 Krátký stisk se ztratil úplně

**Hlášeno u:** Had („nereaguje", „zpoždění šipek"), projevilo by se
u všeho, co čte hranu stisku.

**Příčina:** logika se vzorkuje šedesátkrát za sekundu, ale klávesa nebo
tap můžou trvat kratší dobu než jeden krok. Takový stisk se do vzorku
vůbec nedostal a hra o něm nevěděla. Našel jsem to při testování nové hry
Kostka: ze tří rychlých stisků šipky se do hry dostal jeden.

**Oprava:** správce vstupu si stisky mezi vzorky pamatuje a do nejbližšího
vzorku je doplní — stisk pak trvá právě jeden krok. Platí to i pro
tlačítka dotykového overlay. Determinismus to neruší: do replaye se
zapisuje výsledná maska, kterou server přehraje stejně.

### 2.4 Do vyhledávání nešlo psát

**Příčina:** vstup hry visí na `window` a volal `preventDefault` i na
klávesy, které patřily formulářovému poli v hlavičce.

**Oprava:** `isEditableTarget` v enginu; používá ho vstup i hry s vlastním
posluchačem (Sudoku, Pětipísmenka), aby kontrola byla na jednom místě.

### 2.5 Restart nebyl restart

**Hlášeno u:** „Hrát znovu" po konci hry, čistota stavu po restartu.

**Příčina:** restarty byly dva. Portál volal `instance.restart()`, který
hře nechal **původní seed** (takže další partie byla přesně stejná)
a portálu **staré skóre**. Hra si navíc nechávala běh i `run_id` od
serveru, takže výsledek druhé partie by server odmítl — běh už byl
uzavřený. Běžec navíc restartoval sám sebe zevnitř, úplně mimo portál.

**Oprava:** restart je jedna cesta — portál hru postaví znovu od nuly, což
znamená nový seed, nové `run_id`, vynulované skóre, výsledek i nápovědu
ovládání. `GameInstance.restart()` zmizel z kontraktu i ze všech šestnácti
her. Hra, která chce nový běh sama, si o něj řekne událostí `restart`.

**Vedlejší efekt:** Běžci zmizela výjimka v kontrole determinismu, protože
si už sám neseeduje.

### 2.6 Pauza a konec hry si přebíjely stav

**Příčina:** smyčka pauzuje sama při ztrátě fokusu a hlásí to událostí.
Portál na ni reagoval vždy — i když byla partie dohraná. Alt-tab nad
výsledkovou obrazovkou ji tedy schoval pod překryv pauzy a „Pokračovat"
pak pokračovalo v dohrané partii.

**Oprava:** automatická pauza platí jen pro rozehranou partii. Pauza,
pokračování i restart mají jedno místo pro všechny tři vstupy (lišta,
Escape, překryv), takže se stavy nemůžou rozejít.

### 2.7 Tlačítko „Ovládání" v pauze nedělalo nic

**Příčina:** odscrollovalo na seznam ovládání ve vedlejším panelu — který
překryv pauzy zakrývá.

**Oprava:** překryv ovládání ukazuje rovnou v sobě.

### 2.8 Zvuk po pár hrách zmizel

**Příčina:** portál nikdy nerušil zvukovou sběrnici. Každý přechod mezi
hrami založil nový `AudioContext` a prohlížeč jich povoluje jen několik.
Doznávání skladby navíc ztlumovalo celý hudební kanál, takže skladba
spuštěná během doznívání začala na hlasitosti klesající k nule.

**Oprava:** sběrnice se ruší při opuštění stránky hry; fade má vlastní
uzel, který se po dojetí odpojí.

### 2.9 Nápověda ovládání překrývala hru

**Příčina:** mizela až po dvanácti sekundách nebo když hráč vyzkoušel
všechny akce — u her ovládaných myší prakticky nikdy.

**Oprava:** zmizí tři sekundy po první akci hráče. Pasiáns ji má nově
vpravo dole, kde nezakrývá cílové hromádky.

---

## 3. Opravy v jednotlivých hrách

### Had
- **Bonusy (nové):** magnet na osm sekund přitahuje jídlo k hlavě
  (o pole za posun, pořád po mřížce, takže běh zůstává deterministický),
  nůžky useknou ocas na polovinu, nejméně však na tři články. Objevují se
  zhruba po pátém soustu. Sebrání nemění skóre, takže zvuk hlídá zmizení
  bonusu pod hlavou.
- **Zvuk sebrání** funguje; hlásil ho ten samý zámek zvuku jako 2.8.
- **Zamrznutí a zpoždění šipek:** v pravidlech jsem žádnou příčinu
  nenašel — vstup se vzorkuje každý krok, fronta tahů drží dva tahy
  a tempo se mění jen po snědení jídla. Nejpravděpodobnější příčinou byly
  zaseklé klávesy po ztrátě fokusu (2.2) a phantom tahy (2.2), obojí je
  opravené. Pokud se zpoždění objeví znovu, potřebuju vědět, na jakém
  zařízení a v jakém režimu.

### Hladovec
- **Prachoši po velké tečce neutíkali, protože se vůbec nehýbali.**
  Tolerance „jsem na středu pole" byla 0,06 pole, což je víc než jejich
  krok 0,055: po každém kroku se přichytili zpátky na střed a oscilovali
  na místě. Rychlosti jsou nově zlomky 1/n, takže postava po n krocích ujde
  přesně jedno pole, a tolerance mohla klesnout na 1e-4.
- **Zpomalení o čtvrtinu** vyšlo ze stejné změny: 1/12 hráč, 1/14 Prachoš,
  1/24 vystrašený, 1/7 návrat domů.
- **Útěk:** vystrašený Prachoš volil směr náhodně, takže hráči často vběhl
  do cesty. Nově volí směr, který ho od hráče vzdálí nejvíc, podle stejné
  vzdálenostní mapy jako pronásledování.
- **Chybějící spodní zeď:** první bludiště mělo poslední řádek jako
  chodbu. Spodek je přepsaný a `validateMaze` nově kontroluje celý okraj.
- **Ovoce** se pokládalo na natvrdo spočítaný řádek, který je v prvním
  bludišti zeď — leželo tedy mimo hru a nešlo sebrat. Teď se hledá
  nejbližší průchozí pole.
- **Procházení hráčem:** Prachoš na cestě domů hráčem projde záměrně, jsou
  z něj jen oči. Ostatní ne: při kroku 1/14 pole a detekci na 0,6 pole je
  střet zachycen několik kroků po sobě, tunelování není možné.
- **Náhodný konec hry:** v pravidlech není. Život ubere jen střet a hra
  končí až na nule; `respawnTimer` mezitím krok přeskakuje. Nejspíš šlo
  o zaseklé klávesy (2.2).

### Pexeso
Podle zadání jen ověřeno, nic neměněno. Patnáct testů pravidel prochází
(rozdání dvojic, otáčení, prohlížení, střídání hráčů, konec, čas), kouřový
test hru projde bez chyb v konzoli.

### Invaze
- **Tři obtížnosti** (snadná / střední / těžká) mění tempo sestupu, výšku
  kroku dolů, palbu nepřátel i počet životů.
- **Sestup je pomalejší** na všech obtížnostech; dosavadní jediná hodnota
  byla i na první vlně rychlejší než dnešní „těžká".
- **Přehřátí zbraně:** střílí se rychle, ale každý výstřel přidá teplo,
  které postupně klesá; na stropu se zbraň zablokuje do vychladnutí.
  Ukazatel je pod lodí, ne v hlavičce — hráč se v boji dívá dolů.

### Kostkopád
- **„Hra se sama zastaví":** režim Ultra končí po dvou minutách a Sprint
  po čtyřiceti řadách, ale ani jeden ukazatel nebyl nikde vidět. Postranní
  panel teď v Ultra ukazuje zbývající čas a ve Sprintu řady do cíle.
- **Falešná prohra:** hra má dvě skryté řady nad polem a končí jen tehdy,
  když se nový tvar nevejde ani do nich — to je správné chování. Falešné
  prohry šly nejspíš za zaseklými klávesami (2.2).

### Sudoku
- **Kliknutí na buňky i tlačítka** opravuje 2.1.
- **Režim poznámek** jde přepnout myší (tlačítko Poznámky) i klávesou N.
- **Poznámky jsou odlišené:** dosud tlumená šedá k nerozeznání od zápisu,
  nově sekundární barva značky. Červenou jsem nepoužil schválně — tou hra
  označuje chybný zápis a dvojí význam by čitelnost zhoršil.

### Cihlobijec
- **Zpoždění pádla:** dojíždělo k cíli koeficientem 0,45, tedy zhruba osm
  kroků, a na cíli nikdy přesně nesedělo — za myší to zaostávalo o 130 ms.
  Nově dojede do šesti kroků, poslední půlpixel dosedne přesně a strop
  rychlosti brání teleportu přes celé pole.

### Pětipísmenka
- **Klikání na virtuální klávesnici** opravuje 2.1.
- **Slovo „cihla"** slovník neznal: byla to startovní ručně kurátorovaná
  sada 210 slov. Rozšířena na 418 odpovědí a 446 přijímaných tipů. Test
  hlídá délku pěti znaků, duplicity, malá písmena a to, že běžná slova
  projdou.

### Mávník
- **Falešné kolize:** porovnával se opsaný čtverec draka, ne jeho kruh, takže
  hra hlásila náraz i když se roh čtverce minul se stavbou o pár pixelů.
  Nově kruh proti obdélníku, celé ve fixed-pointu.
- **Strop nezabíjí**, drak se o něj jen zarazí.
- **Přejmenování:** viz kapitola 5.

### Zdvojka
- **Falešná prohra:** konec hry se hlásil ve stejném kroku, ve kterém se
  rozjela animace posunu. Výsledek se objevil nad deskou zamrzlou v pozici
  před posledním tahem — pod ním byly vidět tahy, které už neexistovaly.
  Hlásí se až po dojetí animace.
- Samotné vyhodnocení „není tah" je v pořádku: dvě stě partií dohraných do
  konce, ani jednou konec při volné desce.
- **Přejmenování:** viz kapitola 5.

### Hledač min
- **Kliknutí** opravuje 2.1, **náhodné zvuky** 2.2.
- **Chording** (klik na číslo s dostatkem vlajek) byl implementovaný už
  dřív; po opravě myši je konečně dostupný.
- **Vlajka je červená**, ne v barvě kategorie.
- **Po prohře se odkryjí všechny miny** a špatně umístěné vlajky se
  přeškrtnou. Dosud zůstalo pole zakryté a hráč nevěděl, kde chyboval.

### Běžec
- **Kolizní obdélník** je nově o pár pixelů užší než kresba; hra končila
  i při dotyku, který na obrazovce nebyl vidět.
- **Tři nové vlastní překážky:** nízký široký kámen, úzký vysoký plot
  a převislá větev (jediná, kterou lze jen podběhnout).
- **Grafika:** dvě vrstvy kopců s parallaxem, aby byla vidět rychlost.
  Tvar je daný vzorcem ze vzdálenosti, ne náhodou, takže replay sedí.

### Čtyři v řadě
- **Vhození žetonu klikem do sloupce** bylo implementované; zprovoznila ho
  oprava 2.1.
- **Jeden tón na událost:** hra hraje dva různé zvuky, ale každý na jinou
  událost — vhození a dosednutí. Zdvojený zvuk na jednu událost jsem
  nenašel.

### Piškvorky
- **Kameny na průsečících:** `toScreen` vrací střed pole, ale mřížka se
  kreslila přesně skrz tyhle středy. Čáry jsou teď posunuté o půl buňky,
  takže značky sedí uvnitř čtverců. Ověřeno klikáním v prohlížeči.
- **Kliknutí myší** opravuje 2.1.

### Pasiáns
- **Zásoba a stohování:** hromádka o dvaceti čtyřech kartách sahala přes
  tři sta pixelů dolů a protínala sloupce pod sebou, protože odsazení
  rubových karet se počítalo i u hromádek s nulovým rozkladem. Balíček se
  teď mírně zvedá a nejvýš o šest vrstev; klikatelná je jen vrchní karta.
- **Animace přesunu:** karty mají stabilní `id`, takže stačí porovnat
  rozložení před tahem a po něm. Jedna funkce pokrývá líznutí, poklepání,
  tažení, krok zpět i automatické dokončení. Při zapnutém omezení pohybu
  se animace přeskočí.
- **Přejmenování:** viz kapitola 5.

---

## 4. Co jsem nenašel

U čtyř hlášení jsem v kódu nenašel příčinu a neopravoval jsem naslepo,
protože zadání výslovně zakazuje zásahy podle symptomu:

| Hlášení | Zjištění |
|---|---|
| Had — náhodné zamrznutí | Ani v pravidlech, ani ve smyčce není stav, který by pohyb zastavil. Nejpravděpodobnější příčina (zaseklé klávesy po ztrátě fokusu) je opravená v 2.2 a 2.3. |
| Had — zpoždění šipek | Vstup se vzorkuje každý krok; fronta drží dva tahy. Tempo 9 kroků na pole je dané žánrem. |
| Kostkopád — náhodná prohra | Vyhodnocení konce odpovídá standardu (dvě skryté řady, prohra jen když se tvar nevejde). |
| Hladovec — náhodný konec hry | Život ubere jen střet, hra končí až na nule. |

Pokud se některé z nich vrátí, potřebuju vědět zařízení, prohlížeč a režim,
ve kterém k tomu došlo — a ideálně jestli tomu předcházelo přepnutí okna.

---

## 5. Přejmenování: nesplněno, a proč

Zadání žádá přejmenovat Zdvojku na „2048" a označuje k přejmenování
i Mávníka a Pasiáns. Neudělal jsem to.

Původní zadání portálu má v sekci o duševním vlastnictví pravidlo
označené za nepřekročitelné: *„V UI, URL, metadatech, SEO ani viditelném
kódu nepoužívej chráněné názvy… **Používej názvy z tohoto dokumentu**."*
A ten dokument hru jmenuje **Zdvojka**; „2048" v něm stojí jen v závorce
jako žánrové vysvětlení pro vývojáře. Pravidlo hlídá i CI kontrola
`scripts/check-ip.mjs`.

U Mávníka a Pasiáns navíc zadání nový název neuvádí, takže by nebylo ani
na co přejmenovat.

Rozhodnutí je zapsané jako **D-016** v `DECISIONS.md`. Pokud na
přejmenování trváte, je to vaše rozhodnutí o riziku — stačí doplnit nové
názvy a upravit kontrolu. Do té doby platí přísnější varianta.

---

## 6. Stav

| Kontrola | Výsledek |
|---|---|
| Testy | 575 prošlo (33 souborů) |
| TypeScript | 7 projektů bez chyby |
| Kontrola duševního vlastnictví | prošla |
| Kontrola determinismu | prošla (78 souborů, 1 zdůvodněná výjimka) |
| Kouřový test v prohlížeči | 16 her × desktop i mobil, 0 chyb v konzoli |
| Velikost balíku | vstupní JS 15,9 kB gzip, největší hra 11,0 kB gzip |

Verze pravidel se posunula u Hada, Hladovce, Hledače min, Invaze,
Cihlobijce, Mávníka a Běžce. Nový test hlídá, že verze v pravidlech
a v manifestu hry nezůstanou rozejité — jinak by server přijal běh, který
klient počítal jinak.
