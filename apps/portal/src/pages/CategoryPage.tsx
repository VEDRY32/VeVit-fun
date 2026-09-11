import { useState } from 'react';
import { GameTile, categoryColors, categoryNames } from '@vevit-games/ui';
import type { GameCategory } from '@vevit-games/engine';
import { byCategory, categoriesInOrder } from '../lib/catalog.js';
import { loadFavorites, toggleFavorite } from '../lib/settings.js';
import type { I18n } from '../lib/i18n.js';

export function CategoryPage({ category, i18n }: { category: string; i18n: I18n }): JSX.Element {
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const valid = categoriesInOrder.includes(category as GameCategory);

  if (!valid) {
    return (
      <div className="stav">
        <h1>Takovou kategorii tu nemáme.</h1>
        <a className="tlacitko tlacitko--hlavni" href={`/${i18n.locale}/`}>{i18n.t('error.backHome')}</a>
      </div>
    );
  }

  const key = category as GameCategory;
  const entries = byCategory(key);

  return (
    <div className="vypis" style={{ ['--akcent' as string]: categoryColors[key] }}>
      <h1 className="vypis__nazev">{categoryNames[key][i18n.locale]}</h1>
      <p className="vypis__pocet tabular">
        {entries.length} {i18n.locale === 'cs' ? 'her' : 'games'}
      </p>
      <div className="mrizka">
        {entries.map((entry) => (
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
    </div>
  );
}
