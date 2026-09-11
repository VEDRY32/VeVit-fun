import type { SubmitResponse } from '@vevit-games/engine';

export interface ResultScreenProps {
  open: boolean;
  title: string;
  score: number;
  /** Jednotka určuje formátování — čas se ukazuje jako mm:ss.ms. */
  unit?: 'points' | 'ms' | 'moves' | 'lines';
  personalBest: number | null;
  isNewBest: boolean;
  submission?: SubmitResponse | null;
  /** Sdílený text (u denních her emoji mřížka bez spoilerů). */
  shareText?: string;
  stats?: { label: string; value: string }[];
  onRestart(): void;
  onLeave(): void;
}

export function formatScore(value: number, unit: ResultScreenProps['unit'] = 'points'): string {
  if (unit === 'ms') {
    const minutes = Math.floor(value / 60000);
    const seconds = Math.floor((value % 60000) / 1000);
    const millis = Math.floor((value % 1000) / 10);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
  }
  return value.toLocaleString('cs-CZ');
}

export function ResultScreen({
  open, title, score, unit = 'points', personalBest, isNewBest,
  submission, shareText, stats = [], onRestart, onLeave,
}: ResultScreenProps): JSX.Element | null {
  if (!open) return null;

  const share = async (): Promise<void> => {
    if (!shareText) return;
    // Web Share API má jen část prohlížečů; jinde zkopírujeme do schránky.
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch {
        // Hráč sdílení zrušil — schránka je pořád v pořádku jako záloha.
      }
    }
    await navigator.clipboard?.writeText(shareText);
  };

  return (
    <div className="prekryv" role="dialog" aria-modal="true" aria-label={title}>
      <div className="prekryv__panel vysledek">
        <h2 className="prekryv__nazev">{title}</h2>

        <p className="vysledek__skore tabular">{formatScore(score, unit)}</p>

        {isNewBest ? (
          <p className="vysledek__rekord">Nový osobní rekord</p>
        ) : personalBest != null ? (
          <p className="vysledek__rekord vysledek__rekord--tichy tabular">
            Tvůj rekord: {formatScore(personalBest, unit)}
          </p>
        ) : null}

        {submission?.accepted && submission.rank != null && (
          <p className="vysledek__poradi tabular">
            {submission.rank}. místo v dnešním žebříčku
          </p>
        )}
        {submission && !submission.accepted && (
          <p className="vysledek__chyba">
            Skóre se nepodařilo zapsat. {submission.reason ?? 'Zkus to znovu.'}
          </p>
        )}

        {stats.length > 0 && (
          <dl className="vysledek__statistiky">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd className="tabular">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="prekryv__akce">
          <button type="button" className="tlacitko tlacitko--hlavni" onClick={onRestart}>
            Hrát znovu
          </button>
          {shareText && (
            <button type="button" className="tlacitko" onClick={() => void share()}>
              Sdílet výsledek
            </button>
          )}
          <button type="button" className="tlacitko tlacitko--tiche" onClick={onLeave}>
            Zpátky na hry
          </button>
        </div>
      </div>
    </div>
  );
}
