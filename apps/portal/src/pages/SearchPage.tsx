import { useMemo, useState } from 'react';
import { GameTile } from '@vevit-games/ui';
import { search } from '../lib/catalog.js';
import { loadFavorites, toggleFavorite } from '../lib/settings.js';
import type { I18n } from '../lib/i18n.js';

export function SearchPage({ query, i18n }: { query: string; i18n: I18n }): JSX.Element {
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const results = useMemo(() => search(query), [query]);

  return (
    <div className="vypis">
      <h1 className="vypis__nazev">
        {i18n.locale === 'cs' ? 'Výsledky pro' : 'Results for'} „{query}"
      </h1>

      {results.length === 0 ? (
        <p className="vypis__prazdno">{i18n.t('empty.search')}</p>
      ) : (
        <div className="mrizka">
          {results.map((entry) => (
            <GameTile
              key={entry.manifest.slug}
              manifest={entry.manifest}
              locale={i18n.locale}
              href={`/${i18n.locale}/${entry.manifest.slug}`}
              favorite={favorites.includes(entry.manifest.slug)}
              onToggleFavorite={(slug) => setFavorites(toggleFavorite(slug))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
