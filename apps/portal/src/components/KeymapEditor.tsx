import { useEffect, useState } from 'react';
import { ACTIONS, DEFAULT_KEYMAP, type Action, type Keymap } from '@vevit-games/engine';

/** Lidsky čitelné názvy akcí pro nastavení. */
const ACTION_LABELS: Record<Action, string> = {
  left: 'Doleva',
  right: 'Doprava',
  up: 'Nahoru / otočit',
  down: 'Dolů',
  a: 'Hlavní akce',
  b: 'Druhá akce',
  x: 'Třetí akce',
  y: 'Čtvrtá akce',
  l: 'Levá spoušť',
  r: 'Pravá spoušť',
  start: 'Potvrdit',
  select: 'Pauza',
  pointer: 'Ukazatel',
};

/** Kód klávesy → popisek, který dává smysl na české klávesnici. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) {
    return { Up: '↑', Down: '↓', Left: '←', Right: '→' }[code.slice(5)] ?? code;
  }
  return {
    Space: 'mezerník', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab',
    ShiftLeft: 'levý Shift', ShiftRight: 'pravý Shift',
    ControlLeft: 'levý Ctrl', ControlRight: 'pravý Ctrl',
  }[code] ?? code;
}

export interface KeymapEditorProps {
  keymap: Partial<Keymap>;
  onChange(keymap: Partial<Keymap>): void;
}

/** Akce, které nedává smysl mapovat na klávesu. */
const EDITABLE = ACTIONS.filter((action) => action !== 'pointer');

export function KeymapEditor({ keymap, onChange }: KeymapEditorProps): JSX.Element {
  const [capturing, setCapturing] = useState<Action | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    if (!capturing) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();

      if (event.code === 'Escape') {
        setCapturing(null);
        return;
      }

      // Klávesa smí patřit jen jedné akci, jinak by hra dostala dva povely.
      const owner = EDITABLE.find(
        (action) => action !== capturing && (keymap[action] ?? DEFAULT_KEYMAP[action]).includes(event.code),
      );
      if (owner) {
        setConflict(`${keyLabel(event.code)} už používá „${ACTION_LABELS[owner]}".`);
        return;
      }

      onChange({ ...keymap, [capturing]: [event.code] });
      setConflict(null);
      setCapturing(null);
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [capturing, keymap, onChange]);

  return (
    <div className="klavesy">
      <p className="klavesy__popis">
        Klikni na klávesu a stiskni novou. Escape zruší.
      </p>
      {conflict && <p className="klavesy__konflikt" role="alert">{conflict}</p>}

      <ul className="klavesy__seznam">
        {EDITABLE.map((action) => {
          const keys = keymap[action] ?? DEFAULT_KEYMAP[action];
          return (
            <li key={action}>
              <span>{ACTION_LABELS[action]}</span>
              <button
                type="button"
                className={`klavesy__klavesa ${capturing === action ? 'je-aktivni' : ''}`}
                onClick={() => {
                  setConflict(null);
                  setCapturing(capturing === action ? null : action);
                }}
              >
                {capturing === action ? 'stiskni klávesu…' : keys.map(keyLabel).join(' / ') || '—'}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="tlacitko"
        onClick={() => {
          onChange({});
          setConflict(null);
        }}
      >
        Vrátit výchozí ovládání
      </button>
    </div>
  );
}
