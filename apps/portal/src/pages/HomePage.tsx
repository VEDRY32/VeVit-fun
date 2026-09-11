import { useEffect, useMemo, useRef, useState } from 'react';
import { GameTile, CategoryShelf, categoryColors, categoryNames } from '@vevit-games/ui';
import type { GameModule } from '@vevit-games/engine';
import { catalog, byCategory, bySlug, nonEmptyCategories } from '../lib/catalog.js';
import { loadFavorites, toggleFavorite, loadRecent, type PortalSettings } from '../lib/settings.js';
import { navigate } from '../lib/router.js';
import { DailyPanel } from '../components/DailyPanel.js';
import type { I18n } from '../lib/i18n.js';

/** Hra dne se mění o půlnoci a je pro všechny stejná. */
function gameOfTheDay(): string {
  const today = new Date();
  const days = Math.floor(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86_400_000,
  );
  return catalog[days % catalog.length]!.manifest.slug;
}

export function HomePage({ i18n, settings }: { i18n: I18n; settings: PortalSettings }): JSX.Element {
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [recent] = useState<string[]>(loadRecent);
  const [attractRenderers, setAttractRenderers] = useState<Record<string, GameModule['renderAttract']>>({});

  const heroSlug = useMemo(gameOfTheDay, []);
  const hero = bySlug(heroSlug);
  const heroCanvas = useRef<HTMLCanvasElement>(null);

  // Attract ukázky se načítají na pozadí — dlaždice mezitím drží svůj tvar,
  // takže rozložení neposkakuje.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded: Record<string, GameModule['renderAttract']> = {};
      for (const entry of catalog) {
        try {
          const module = await entry.load();
          if (module.renderAttract) loaded[entry.manifest.slug] = module.renderAttract;
        } catch {
          // Hru, která se nenačte, prostě ukážeme bez ukázky.
        }
      }
      if (!cancelled) setAttractRenderers(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hero běží v attract módu; mezerník nebo tap spustí hru rovnou odsud.
  useEffect(() => {
    const canvas = heroCanvas.current;
    const render = attractRenderers[heroSlug];
    if (!canvas || !render) return;

    if (settings.reducedMotion) {
      // Stejně jako u dlaždic: v čase 0 většina ukázek ještě nic nenakreslí.
      render(canvas, 1.8);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const frame = (now: number): void => {
      render(canvas, (now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [attractRenderers, heroSlug, settings.reducedMotion]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, button, a, select')) return;
      event.preventDefault();
      navigate(`/${i18n.locale}/${heroSlug}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [heroSlug, i18n.locale]);

  const onFavorite = (slug: string): void => setFavorites(toggleFavorite(slug));

  const renderTile = (slug: string): JSX.Element | null => {
    const entry = bySlug(slug);
    if (!entry) return null;
    return (
      <GameTile
        key={slug}
        manifest={entry.manifest}
        locale={i18n.locale}
        href={`/${i18n.locale}/${slug}`}
        favorite={favorites.includes(slug)}
        onToggleFavorite={onFavorite}
        renderAttract={attractRenderers[slug]}
      />
    );
  };

  return (
    <div className="domu">
      <section className="hero" style={{ ['--akcent' as string]: hero ? categoryColors[hero.manifest.category] : undefined }}>
        <a className="hero__plocha" href={`/${i18n.locale}/${heroSlug}`}>
          <canvas ref={heroCanvas} width={960} height={540} aria-hidden="true" />
          <span className="hero__popisek">
            <span className="hero__stitek">{i18n.t('home.gameOfDay')}</span>
            <span className="hero__nazev">{hero?.manifest.title[i18n.locale]}</span>
            <span className="hero__vyzva">{i18n.t('home.heroHint')}</span>
          </span>
        </a>

        <DailyPanel i18n={i18n} />
      </section>

      {recent.length > 0 && (
        <CategoryShelf title={i18n.t('home.recent')}>
          {recent.map(renderTile)}
        </CategoryShelf>
      )}

      {favorites.length > 0 && (
        <CategoryShelf title={i18n.t('home.favorites')}>
          {favorites.map(renderTile)}
        </CategoryShelf>
      )}

      {nonEmptyCategories().map((category) => (
        <CategoryShelf
          key={category}
          title={categoryNames[category][i18n.locale]}
          accent={categoryColors[category]}
          moreHref={`/${i18n.locale}/kategorie/${category}`}
          moreLabel={i18n.locale === 'cs' ? 'Zobrazit vše' : 'Show all'}
        >
          {byCategory(category).map((entry) => renderTile(entry.manifest.slug))}
        </CategoryShelf>
      ))}
    </div>
  );
}
