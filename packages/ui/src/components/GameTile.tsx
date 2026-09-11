import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameManifest, Locale } from '@vevit-games/engine';
import { categoryColors, categoryNames } from '../tokens.js';

export interface GameTileProps {
  manifest: GameManifest;
  locale: Locale;
  href: string;
  /** Počet hráčů online — jen u multiplayeru. */
  onlineCount?: number;
  favorite?: boolean;
  onToggleFavorite?: (slug: string) => void;
  /** Vykreslí samohrající ukázku při najetí myší (desktop). */
  renderAttract?: (canvas: HTMLCanvasElement, t: number) => void;
  size?: 'normal' | 'large';
}

/**
 * Dlaždice hry — tvar herní kazety se zkoseným rohem a spodním pruhem
 * v barvě kategorie. Na desktopu při najetí rozběhne attract smyčku,
 * jinak drží statický obrázek. Bez plošných šedých stínů; zvýraznění
 * je rozsvícený okraj v barvě hry.
 */
export function GameTile({
  manifest, locale, href, onlineCount, favorite = false,
  onToggleFavorite, renderAttract, size = 'normal',
}: GameTileProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState(false);
  const accent = categoryColors[manifest.category];

  // Statický snímek se nekreslí v čase 0: většina ukázek tam teprve začíná
  // a dlaždice by zůstala prázdná. Tohle je okamžik, kdy už je co vidět.
  const STATIC_FRAME_SECONDS = 1.8;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderAttract) return;

    // Bez najetí stačí jeden statický snímek — smyčka v každé dlaždici
    // by na stránce s padesáti hrami sežrala celý procesor.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!hovered || reduced) {
      renderAttract(canvas, STATIC_FRAME_SECONDS);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const frame = (now: number): void => {
      renderAttract(canvas, (now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [hovered, renderAttract]);

  const style = {
    '--akcent': accent,
  } as CSSProperties;

  return (
    <article
      className={`dlazdice ${size === 'large' ? 'dlazdice--velka' : ''}`}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <a className="dlazdice__odkaz" href={href}>
        <span className="dlazdice__plocha">
          <canvas ref={canvasRef} width={320} height={200} aria-hidden="true" />
        </span>
        <span className="dlazdice__telo">
          <span className="dlazdice__nazev">{manifest.title[locale]}</span>
          <span className="dlazdice__popis">{manifest.tagline[locale]}</span>
        </span>
        <span className="dlazdice__pruh" aria-hidden="true" />
      </a>

      <p className="dlazdice__meta">
        <span>{categoryNames[manifest.category][locale]}</span>
        {onlineCount != null && (
          <span className="dlazdice__online tabular">
            {onlineCount} {locale === 'cs' ? 'online' : 'online'}
          </span>
        )}
      </p>

      {onToggleFavorite && (
        <button
          type="button"
          className="dlazdice__srdce"
          aria-pressed={favorite}
          onClick={() => onToggleFavorite(manifest.slug)}
        >
          <span aria-hidden="true">{favorite ? '♥' : '♡'}</span>
          <span className="vizualne-skryte">
            {favorite
              ? `Odebrat ${manifest.title[locale]} z oblíbených`
              : `Přidat ${manifest.title[locale]} do oblíbených`}
          </span>
        </button>
      )}
    </article>
  );
}
