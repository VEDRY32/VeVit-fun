import { useMemo } from 'react';
import { categoryColors } from '@vevit-games/ui';
import { badgeStates, unlockedCount, BADGES } from '../lib/badges.js';
import { currentStreak, bestStreak, progressToday } from '../lib/daily.js';
import { loadFavorites, loadRecent } from '../lib/settings.js';
import { bySlug } from '../lib/catalog.js';
import type { I18n } from '../lib/i18n.js';

/**
 * Profil hráče.
 *
 * Zatím čistě z lokálního stavu — přihlášení a serverový profil přijdou
 * s multiplayerem. Rozložení i výpočty zůstanou stejné, jen se stav načte
 * odjinud.
 */
export function ProfilePage({ i18n }: { i18n: I18n }): JSX.Element {
  const badges = useMemo(() => badgeStates(), []);
  const unlocked = useMemo(() => unlockedCount(), []);
  const streak = useMemo(() => currentStreak(), []);
  const best = useMemo(() => bestStreak(), []);
  const progress = useMemo(() => progressToday(), []);
  const favorites = useMemo(() => loadFavorites(), []);
  const recent = useMemo(() => loadRecent(), []);

  const globalBadges = badges.filter((badge) => badge.scope === 'global');
  const gameBadges = badges.filter((badge) => badge.scope === 'game');

  return (
    <div className="profil">
      <h1>{i18n.t('profile.title')}</h1>
      <p className="profil__poznamka">{i18n.t('profile.localOnly')}</p>

      <section className="profil__prehled">
        <div>
          <span className="profil__cislo tabular">{streak}</span>
          <span className="profil__popisek">{i18n.t('home.streak')}</span>
        </div>
        <div>
          <span className="profil__cislo tabular">{best}</span>
          <span className="profil__popisek">{i18n.t('profile.bestStreak')}</span>
        </div>
        <div>
          <span className="profil__cislo tabular">{progress.done}/{progress.total}</span>
          <span className="profil__popisek">{i18n.t('profile.todayDone')}</span>
        </div>
        <div>
          <span className="profil__cislo tabular">{unlocked}/{BADGES.length}</span>
          <span className="profil__popisek">{i18n.t('profile.badges')}</span>
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <h2>{i18n.t('home.recent')}</h2>
          <ul className="profil__hry">
            {recent.map((slug) => {
              const entry = bySlug(slug);
              if (!entry) return null;
              return (
                <li key={slug} style={{ ['--akcent' as string]: categoryColors[entry.manifest.category] }}>
                  <a href={`/${i18n.locale}/${slug}`}>{entry.manifest.title[i18n.locale]}</a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {favorites.length > 0 && (
        <section>
          <h2>{i18n.t('home.favorites')}</h2>
          <ul className="profil__hry">
            {favorites.map((slug) => {
              const entry = bySlug(slug);
              if (!entry) return null;
              return (
                <li key={slug} style={{ ['--akcent' as string]: categoryColors[entry.manifest.category] }}>
                  <a href={`/${i18n.locale}/${slug}`}>{entry.manifest.title[i18n.locale]}</a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2>{i18n.t('profile.globalBadges')}</h2>
        <ul className="odznaky">
          {globalBadges.map((badge) => (
            <li key={badge.id} className={badge.unlocked ? 'je-ziskany' : ''}>
              <span className="odznaky__znak" aria-hidden="true">
                {badge.unlocked ? '★' : badge.hidden ? '?' : '☆'}
              </span>
              <span className="odznaky__text">
                <strong>
                  {badge.hidden && !badge.unlocked ? i18n.t('profile.hiddenBadge') : badge.title}
                </strong>
                <small>
                  {badge.hidden && !badge.unlocked
                    ? i18n.t('profile.hiddenBadgeHelp')
                    : badge.description}
                </small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{i18n.t('profile.gameBadges')}</h2>
        <ul className="odznaky">
          {gameBadges.map((badge) => {
            const entry = badge.game ? bySlug(badge.game) : undefined;
            return (
              <li key={badge.id} className={badge.unlocked ? 'je-ziskany' : ''}>
                <span className="odznaky__znak" aria-hidden="true">{badge.unlocked ? '★' : '☆'}</span>
                <span className="odznaky__text">
                  <strong>{badge.title}</strong>
                  <small>
                    {entry ? `${entry.manifest.title[i18n.locale]} — ` : ''}
                    {badge.description}
                  </small>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
