import { useRef, type ReactNode } from 'react';

export interface CategoryShelfProps {
  title: string;
  accent?: string;
  children: ReactNode;
  /** Odkaz na výpis celé kategorie. */
  moreHref?: string;
  moreLabel?: string;
}

/**
 * Vodorovná police dlaždic se scroll-snapem.
 * Na desktopu má šipky, klávesnicí se prochází přirozeně tabem —
 * fokus posune polici sám díky `scroll-snap` a `scroll-margin`.
 */
export function CategoryShelf({
  title, accent, children, moreHref, moreLabel,
}: CategoryShelfProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (direction: -1 | 1): void => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="police" style={accent ? ({ ['--akcent' as string]: accent }) : undefined}>
      <header className="police__hlavicka">
        <h2 className="police__nazev">{title}</h2>
        <div className="police__ovladani">
          {moreHref && (
            <a className="police__vice" href={moreHref}>
              {moreLabel ?? 'Zobrazit vše'}
            </a>
          )}
          <button type="button" className="police__sipka" onClick={() => scrollBy(-1)}>
            <span aria-hidden="true">‹</span>
            <span className="vizualne-skryte">Posunout doleva</span>
          </button>
          <button type="button" className="police__sipka" onClick={() => scrollBy(1)}>
            <span aria-hidden="true">›</span>
            <span className="vizualne-skryte">Posunout doprava</span>
          </button>
        </div>
      </header>
      <div className="police__pas" ref={trackRef}>
        {children}
      </div>
    </section>
  );
}
