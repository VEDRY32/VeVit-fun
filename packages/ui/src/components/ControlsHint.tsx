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
}

/**
 * Interaktivní nápověda ovládání při prvním spuštění.
 * Každý řádek zmizí, jakmile hráč danou akci poprvé použije, takže nápověda
 * sama od sebe dojde a nemusí se zavírat.
 */
export function ControlsHint({ items, used, visible }: ControlsHintProps): JSX.Element | null {
  const remaining = items.filter((item) => !used.has(item.action));
  if (!visible || remaining.length === 0) return null;

  return (
    <div className="napoveda" aria-live="polite">
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
