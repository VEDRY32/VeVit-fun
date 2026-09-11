import { useEffect, useRef } from 'react';

export interface PauseOverlayProps {
  open: boolean;
  title?: string;
  onResume(): void;
  onRestart(): void;
  onControls(): void;
  onSettings(): void;
  onLeave(): void;
}

/**
 * Jednotná pauza pro všechny hry.
 *
 * Drží fokus uvnitř (hráč se klávesnicí nedostane na stránku pod hrou)
 * a Escape vrací do hry.
 */
export function PauseOverlay({
  open, title = 'Pauza', onResume, onRestart, onControls, onSettings, onLeave,
}: PauseOverlayProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onResume();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onResume]);

  if (!open) return null;

  return (
    <div className="prekryv" role="dialog" aria-modal="true" aria-label={title}>
      <div className="prekryv__panel" ref={panelRef}>
        <h2 className="prekryv__nazev">{title}</h2>
        <div className="prekryv__akce">
          <button ref={firstRef} type="button" className="tlacitko tlacitko--hlavni" onClick={onResume}>
            Pokračovat
          </button>
          <button type="button" className="tlacitko" onClick={onRestart}>Hrát znovu</button>
          <button type="button" className="tlacitko" onClick={onControls}>Ovládání</button>
          <button type="button" className="tlacitko" onClick={onSettings}>Nastavení</button>
          <button type="button" className="tlacitko tlacitko--tiche" onClick={onLeave}>Odejít</button>
        </div>
      </div>
    </div>
  );
}
