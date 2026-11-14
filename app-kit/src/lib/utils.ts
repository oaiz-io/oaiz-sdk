import * as React from 'react';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Suppresses the false-positive `:focus-visible` ring browsers paint when an
 * overlay unmounts after a pointer selection and programmatically restores DOM
 * focus onto its trigger. Focus stays on the trigger for WAI-ARIA continuity
 * and scoped shortcuts; the marker clears on the next keydown or blur.
 */
export function suppressPointerAutoFocusRing(): void {
  const previousActive =
    typeof document !== 'undefined' ? document.activeElement : null;
  queueMicrotask(() => {
    const active =
      typeof document !== 'undefined' ? document.activeElement : null;
    if (
      !(active instanceof HTMLElement) ||
      active === document.body ||
      active === previousActive
    ) {
      return;
    }
    active.dataset.pointerCloseFocus = '';
    const clear = () => {
      delete active.dataset.pointerCloseFocus;
      active.removeEventListener('blur', clear);
      window.removeEventListener('keydown', clear, true);
    };
    active.addEventListener('blur', clear, { once: true });
    window.addEventListener('keydown', clear, { capture: true, once: true });
  });
}

interface PointerCloseFocusHandlers<
  TEscape extends Event,
  TPointerOutside extends Event,
  TCloseAutoFocus extends Event,
> {
  onPointerDownCapture?: React.PointerEventHandler | undefined;
  onClickCapture?: React.MouseEventHandler | undefined;
  onKeyDownCapture?: React.KeyboardEventHandler | undefined;
  onEscapeKeyDown?: ((event: TEscape) => void) | undefined;
  onPointerDownOutside?: ((event: TPointerOutside) => void) | undefined;
  onCloseAutoFocus?: ((event: TCloseAutoFocus) => void) | undefined;
}

/**
 * Wraps an overlay content's handlers so that closing by pointer hides the
 * focus ring on the trigger Radix refocuses. Spread the result onto the Radix
 * content after the caller's remaining props; the caller's own handlers still
 * run first.
 */
export function usePointerCloseFocus<
  TEscape extends Event,
  TPointerOutside extends Event,
  TCloseAutoFocus extends Event,
>(
  handlers: PointerCloseFocusHandlers<
    TEscape,
    TPointerOutside,
    TCloseAutoFocus
  >,
) {
  const {
    onPointerDownCapture,
    onClickCapture,
    onKeyDownCapture,
    onEscapeKeyDown,
    onPointerDownOutside,
    onCloseAutoFocus,
  } = handlers;
  const closedByPointerRef = React.useRef(false);

  return {
    onPointerDownCapture: (event: React.PointerEvent) => {
      closedByPointerRef.current = true;
      onPointerDownCapture?.(event);
    },
    onClickCapture: (event: React.MouseEvent) => {
      if (event.detail > 0) closedByPointerRef.current = true;
      onClickCapture?.(event);
    },
    onKeyDownCapture: (event: React.KeyboardEvent) => {
      closedByPointerRef.current = false;
      onKeyDownCapture?.(event);
    },
    onEscapeKeyDown: (event: TEscape) => {
      closedByPointerRef.current = false;
      onEscapeKeyDown?.(event);
    },
    onPointerDownOutside: (event: TPointerOutside) => {
      onPointerDownOutside?.(event);
      closedByPointerRef.current = !event.defaultPrevented;
    },
    onCloseAutoFocus: (event: TCloseAutoFocus) => {
      const closedByPointer = closedByPointerRef.current;
      closedByPointerRef.current = false;
      onCloseAutoFocus?.(event);
      if (!event.defaultPrevented && closedByPointer) {
        suppressPointerAutoFocusRing();
      }
    },
  };
}
