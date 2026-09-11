# Pipeline pro slovníky

Cílový stav podle zadání: ~2 500 ručně prošlých odpovědí a širší seznam
povolených tipů. Současný stav: **210 odpovědí** v
`titles/petipismenka/src/data/words-cs.ts`, ručně kurátorované.

## Postup pro rozšíření

1. **Zdroj.** Frekvenční seznam s ověřenou licencí — bez NC klauzule.
   Kandidáti a jejich licence patří do `THIRD_PARTY.md` **před** stažením.
2. **Filtr.** Pětiznaková slova (po NFC normalizaci, diakritika se počítá
   jako jeden znak), jen spisovná, podstatná jména v 1. pádě, přídavná
   jména a pětipísmenné infinitivy.
3. **Vyřazení.** Vlastní jména, zkratky, vulgarismy, hovorové tvary,
   slova s `ch` na hranici dělení (viz poznámka níže).
4. **Ruční kontrola.** Seznam odpovědí musí projít člověk. Tipy stačí
   projet filtrem — nefér odpověď je horší než nepřijatý tip.
5. **Výstup.** Vygenerovaný `words-cs.ts` ve stejném formátu, který
   klient i worker už používají. Formát se nemění.

## Poznámka k „ch"

Hra pracuje se znaky, ne s hláskami: `ch` se počítá jako **dva znaky**
(`c` + `h`). Slovo „chleb" má tedy pět znaků a do hry se vejde, zatímco
„chyba" taky pět. Zdokumentováno i v UI hry, aby to hráče nepřekvapilo.

## Diakritika

`á` a `a` jsou různá písmena. Nekonečný režim nabízí volbu „bez diakritiky",
která porovnává po odstranění háčků a čárek; denní režim ji nemá, aby měli
všichni hráči stejné zadání.
