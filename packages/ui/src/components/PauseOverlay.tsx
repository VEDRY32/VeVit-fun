import { useEffect, useRef, useState } from 'react';

export interface ControlRow {
  keys: string;
  label: string;
}

export interface PauseOverlayProps {
  open: boolean;
  title?: string;
  /**
   * Ovládání hry. Pauza ho umí ukázat rovnou v překryvu — odkazovat na
   * seznam ve vedlejším panelu nemá smysl, překryv ho zakrývá.
   */
  controls?: readonly ControlRow[];
  onResume(): void;
  onRestart(): void;
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
  open, title = 'Pauza', controls = [], onResume, onRestart, onSettings, onLeave,
}: PauseOverlayProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const [showControls, setShowControls] = useState(false);

  // Každá nová pauza začíná se sbaleným ovládáním.
  useEffect(() => {
    if (!open) setShowControls(false);
  }, [open]);

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
          {controls.length > 0 && (
            <button
              type="button"
              className="tlacitko"
              aria-expanded={showControls}
              onClick={() => setShowControls((v) => !v)}
            >
              Ovládání
            </button>
          )}
          {showControls && (
            <ul className="prekryv__ovladani">
              {controls.map((row) => (
                <li key={row.keys + row.label}>
                  <kbd>{row.keys}</kbd>
                  <span>{row.label}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="tlacitko" onClick={onSettings}>Nastavení</button>
          <button type="button" className="tlacitko tlacitko--tiche" onClick={onLeave}>Odejít</button>
        </div>
      </div>
    </div>
  );
}
