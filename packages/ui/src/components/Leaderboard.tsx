import { useState } from 'react';
import { formatScore } from './ResultScreen.js';

export type LeaderboardPeriod = 'dnes' | 'tyden' | 'navzdy';

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  score: number;
  /** Řádek patří přihlášenému hráči — zvýrazní se. */
  isMe?: boolean;
}

export interface LeaderboardProps {
  entries: Record<LeaderboardPeriod, LeaderboardEntry[]>;
  /** Pozice hráče, když je mimo zobrazený výřez. */
  myEntry?: LeaderboardEntry | null;
  unit?: 'points' | 'ms' | 'moves' | 'lines';
  loading?: boolean;
}

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  dnes: 'Dnes',
  tyden: 'Týden',
  navzdy: 'Navždy',
};

export function Leaderboard({
  entries, myEntry, unit = 'points', loading = false,
}: LeaderboardProps): JSX.Element {
  const [period, setPeriod] = useState<LeaderboardPeriod>('dnes');
  const rows = entries[period] ?? [];
  const myRowVisible = rows.some((row) => row.isMe);

  return (
    <div className="zebricek">
      <div className="zebricek__prepinac" role="tablist" aria-label="Období žebříčku">
        {(Object.keys(PERIOD_LABELS) as LeaderboardPeriod[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={period === key}
            className={`zebricek__zalozka ${period === key ? 'je-aktivni' : ''}`}
            onClick={() => setPeriod(key)}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="zebricek__stav">Načítám…</p>
      ) : rows.length === 0 ? (
        <p className="zebricek__stav">
          Zatím tu nikdo není. Zahraj si a buď první.
        </p>
      ) : (
        <ol className="zebricek__seznam">
          {rows.map((row) => (
            <li key={`${row.rank}-${row.nickname}`} className={row.isMe ? 'je-muj' : ''}>
              <span className="zebricek__poradi tabular">{row.rank}.</span>
              <span className="zebricek__jmeno">{row.nickname}</span>
              <span className="zebricek__skore tabular">{formatScore(row.score, unit)}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Vlastní pozice se ukáže i mimo zobrazený výřez. */}
      {myEntry && !myRowVisible && (
        <ol className="zebricek__seznam zebricek__seznam--moje">
          <li className="je-muj">
            <span className="zebricek__poradi tabular">{myEntry.rank}.</span>
            <span className="zebricek__jmeno">{myEntry.nickname}</span>
            <span className="zebricek__skore tabular">{formatScore(myEntry.score, unit)}</span>
          </li>
        </ol>
      )}
    </div>
  );
}
