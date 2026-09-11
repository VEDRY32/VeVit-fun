import { useEffect, useRef } from 'react';
import type { Action, InputManager } from '@vevit-games/engine';

export interface TouchButton {
  action: Action;
  label: string;
  /** Pozice v procentech herní plochy. */
  x: number;
  y: number;
  size?: number;
}

export interface TouchOverlayProps {
  input: InputManager;
  buttons: TouchButton[];
  /** Zrcadlí rozložení pro leváky. */
  leftHanded?: boolean;
  visible: boolean;
}

/**
 * Dotykové ovládání.
 *
 * Tlačítka jsou průhledná a mají nejméně 48 px, aby se dala trefit palcem.
 * Používá pointer události, takže jeden prst může tlačítko držet a druhý
 * mačkat jiné.
 */
export function TouchOverlay({
  input, buttons, leftHanded = false, visible,
}: TouchOverlayProps): JSX.Element | null {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Když hráč odejde z obrazovky s prstem na tlačítku, akce by zůstala
    // „držená" napořád.
    const release = (): void => {
      for (const button of buttons) input.setVirtual(button.action, false);
    };
    window.addEventListener('blur', release);
    window.addEventListener('pointercancel', release);
    return () => {
      release();
      window.removeEventListener('blur', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [input, buttons]);

  if (!visible) return null;

  return (
    <div className="dotyk" ref={rootRef} aria-hidden="true">
      {buttons.map((button) => {
        const x = leftHanded ? 100 - button.x : button.x;
        return (
          <button
            key={button.action + button.label}
            type="button"
            className="dotyk__tlacitko"
            style={{
              left: `${x}%`,
              top: `${button.y}%`,
              width: `${button.size ?? 64}px`,
              height: `${button.size ?? 64}px`,
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              input.setVirtual(button.action, true);
            }}
            onPointerUp={() => input.setVirtual(button.action, false)}
            onPointerLeave={() => input.setVirtual(button.action, false)}
            tabIndex={-1}
          >
            {button.label}
          </button>
        );
      })}
    </div>
  );
}
