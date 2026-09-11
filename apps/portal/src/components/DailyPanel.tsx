import { useMemo } from 'react';
import { challengesFor, currentStreak, progressToday, dayNumber } from '../lib/daily.js';
import type { I18n } from '../lib/i18n.js';

/**
 * Panel denních výzev na domovské stránce.
 *
 * Ukazuje tři dnešní hry, které jsou hotové, a sérii dní. Série je to
 * hlavní, co vrací hráče zpátky, takže má vlastní místo, ne poznámku pod čarou.
 */
export function DailyPanel({ i18n }: { i18n: I18n }): JSX.Element {
  const challenges = useMemo(() => challengesFor(), []);
  const streak = useMemo(() => currentStreak(), []);
  const progress = useMemo(() => progressToday(), []);
  const day = useMemo(() => dayNumber(), []);

  return (
    <aside className="vyzvy">
      <header className="vyzvy__hlavicka">
        <h2 className="vyzvy__nazev">{i18n.t('home.daily')}</h2>
        <span className="vyzvy__cislo tabular">#{day}</span>
      </header>

      <p className="vyzvy__popis">{i18n.t('home.dailyBody')}</p>

      {challenges.length === 0 ? (
        <p className="vyzvy__popis">Dnes tu žádná výzva není.</p>
      ) : (
        <ul className="vyzvy__seznam">
          {challenges.map((challenge) => (
            <li key={challenge.slug}>
              <a
                href={`/${i18n.locale}/${challenge.slug}?rezim=denni`}
                className={challenge.done ? 'je-hotovo' : ''}
              >
                <span className="vyzvy__stav" aria-hidden="true">
                  {challenge.done ? '✓' : '○'}
                </span>
                <span>{challenge.title}</span>
                {challenge.score != null && (
                  <span className="vyzvy__skore tabular">{challenge.score}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}

      <footer className="vyzvy__pata">
        <span className="tabular">
          {progress.done}/{progress.total} hotovo
        </span>
        {streak > 0 && (
          <span className="vyzvy__serie tabular">
            {i18n.t('home.streak')} {streak} 🔥
          </span>
        )}
      </footer>
    </aside>
  );
}
