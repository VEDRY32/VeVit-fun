import { useState, type FormEvent } from 'react';
import type { Locale } from '@vevit-games/engine';
import { categoryNames } from '@vevit-games/ui';
import { navigate } from '../lib/router.js';
import { nonEmptyCategories } from '../lib/catalog.js';
import type { I18n } from '../lib/i18n.js';

export function Header({ i18n, locale }: { i18n: I18n; locale: Locale }): JSX.Element {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (query.trim().length === 0) return;
    navigate(`/${locale}/hledat?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="hlavicka">
      <a className="hlavicka__znacka" href={`/${locale}/`}>
        <span className="hlavicka__logo" aria-hidden="true">
          <span /><span /><span /><span />
        </span>
        VeVit Games
      </a>

      <form className="hlavicka__hledani" role="search" onSubmit={submit}>
        <label className="vizualne-skryte" htmlFor="hledat">{i18n.t('nav.search')}</label>
        <input
          id="hledat"
          type="search"
          placeholder={i18n.t('nav.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <nav className="hlavicka__nav">
        <div className="hlavicka__kategorie">
          <button
            type="button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {i18n.t('nav.categories')}
          </button>
          {menuOpen && (
            <ul className="hlavicka__rozbal" onMouseLeave={() => setMenuOpen(false)}>
              {nonEmptyCategories().map((category) => (
                <li key={category}>
                  <a href={`/${locale}/kategorie/${category}`} onClick={() => setMenuOpen(false)}>
                    {categoryNames[category][locale]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <a href={`/${locale}/profil`}>{i18n.t('nav.profile')}</a>
        <a href={`/${locale}/nastaveni`}>{i18n.t('nav.settings')}</a>
      </nav>
    </header>
  );
}
