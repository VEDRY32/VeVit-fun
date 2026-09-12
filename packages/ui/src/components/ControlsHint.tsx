import { useEffect, useState } from 'react';
import type { Action } from '@vevit-games/engine';

export interface ControlHintItem {
  action: Action;
  label: string;
  /** Popis klávesy nebo gesta, např. „← →" nebo „tah prstem". */
  keys: string;
}

export interface ControlsHintProps {
  items: ControlHintItem[];
  /** Akce, které už hráč vyzkoušel — zmizí z nápovědy. */
  used: ReadonlySet<Action>;
  visible: boolean;
  /**
   * Kde nápověda leží. Výchozí je vlevo dole; hry, které tam mají
   * ovládací prvky (číselník, tlačítka), si zvolí jiný roh.
   */
  anchor?: 'vlevo-dole' | 'vlevo-nahore' | 'vpravo-dole' | 'vpravo-nahore';
  /** Po kolika sekundách nápověda zmizí sama. */
  timeoutSeconds?: number;
  /**
   * Po kolika sekundách zmizí od chvíle, kdy hráč použil první akci.
   * Kdo už hraje, nápovědu nečte — a ta pak jen překáží.
   */
  afterFirstActionSeconds?: number;
}

/**
 * Interaktivní nápověda ovládání při prvním spuštění.
 *
 * Řádek zmizí, jakmile hráč danou akci poprvé použije. Navíc má časový
 * strop: hry, jejichž ovládání je myší nebo tapem, by jinak nápovědu
 * nikdy neodbavily a ta by trvale překrývala část plochy — přesně to se
 * stalo Sudoku, kde zakrývala číselník.
 */
export function ControlsHint({
  items, used, visible, anchor = 'vlevo-dole',
  timeoutSeconds = 12, afterFirstActionSeconds = 3,
}: ControlsHintProps): JSX.Element | null {
  const [expired, setExpired] = useState(false);
  const started = used.size > 0;

  useEffect(() => {
    if (!visible || timeoutSeconds <= 0) return;
    const timer = window.setTimeout(() => setExpired(true), timeoutSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [visible, timeoutSeconds]);

  useEffect(() => {
    if (!visible || !started || afterFirstActionSeconds <= 0) return;
    const timer = window.setTimeout(() => setExpired(true), afterFirstActionSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [visible, started, afterFirstActionSeconds]);

  const remaining = items.filter((item) => !used.has(item.action));
  if (!visible || expired || remaining.length === 0) return null;

  return (
    <div className={`napoveda napoveda--${anchor}`} aria-live="polite">
      <ul className="napoveda__seznam">
        {remaining.map((item) => (
          <li key={item.action}>
            <kbd className="napoveda__klavesa">{item.keys}</kbd>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
