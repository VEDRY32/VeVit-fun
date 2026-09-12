/**
 * Hlídač toho, který rozehraný běh hry je ještě aktuální.
 *
 * Spuštění hry není okamžité: portál mezitím načte herní modul a vyžádá si
 * ze serveru běh se seedem. Než to doběhne, může přijít další spuštění —
 * restart, změna režimu, nebo ve `StrictMode` rovnou druhý průchod efektu.
 * Bez tohohle hlídače doběhnou obě volání až za `await` a obě namountují
 * vlastní instanci hry. Portál si zapamatuje jen tu poslední a ta první
 * osiří: její smyčka běží dál, dostává stejné klávesy a po chvíli sama
 * dohraje. Její `gameover` pak ukončí partii, kterou hráč právě hraje —
 * navenek se hra „bezdůvodně prohraje".
 *
 * Každé spuštění si proto vezme token a po každém `await` se zeptá, jestli
 * je pořád na řadě. Když ne, tiše skončí a po sobě uklidí.
 */

export interface RunToken {
  /** Je tohle pořád ten běh, o který portál stojí? */
  readonly current: boolean;
}

export interface RunTracker {
  /** Začne nový běh. Všechny dřív vydané tokeny tím zastarají. */
  begin(): RunToken;
  /** Zneplatní i ten poslední token — pro úklid při odchodu ze stránky. */
  cancel(): void;
}

export function createRunTracker(): RunTracker {
  let generation = 0;

  return {
    begin() {
      const mine = ++generation;
      return {
        get current() {
          return generation === mine;
        },
      };
    },
    cancel() {
      generation++;
    },
  };
}
