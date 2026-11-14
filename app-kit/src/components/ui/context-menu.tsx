import * as React from 'react';
import { createPortal } from 'react-dom';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '../../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './dropdown-menu';

/** How long a touch must rest before it opens the menu, as on iOS and Android. */
const LONG_PRESS_MS = 500;
/** A touch that drifts further than this is a scroll or a drag, not a press. */
const LONG_PRESS_SLOP_PX = 10;

interface ContextMenuContextValue {
  openAt: (x: number, y: number) => void;
  returnFocus: () => void;
}

const ContextMenuContext = React.createContext<ContextMenuContextValue | null>(
  null,
);

function useContextMenuContext(component: string) {
  const context = React.useContext(ContextMenuContext);
  if (!context) throw new Error(`${component} must be inside <ContextMenu>`);
  return context;
}

/**
 * A menu that opens where the user right-clicks, long-presses, or presses the
 * Menu key or Shift+F10. Its items are the `DropdownMenu` items, so a row's
 * "⋯" menu and its context menu can render the same item list.
 */
function ContextMenu({
  children,
  onOpenChange,
}: {
  children?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = React.useState(false);
  // The point stays after closing so the menu does not jump while it fades.
  const [point, setPoint] = React.useState<{ x: number; y: number } | null>(
    null,
  );
  const focusOrigin = React.useRef<HTMLElement | null>(null);

  const context = React.useMemo<ContextMenuContextValue>(
    () => ({
      openAt: (x, y) => {
        focusOrigin.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setPoint({ x, y });
        setOpen(true);
        onOpenChange?.(true);
      },
      returnFocus: () => focusOrigin.current?.focus(),
    }),
    [onOpenChange],
  );

  return (
    <ContextMenuContext.Provider value={context}>
      <DropdownMenu
        modal={false}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
      >
        {/* A zero-size anchor at the pointer, outside the trigger's own
            markup so the trigger can be any element, including a table row. */}
        {/* Mounted from the first open on, so long lists of rows do not each
            add an anchor to the page. */}
        {point && typeof document !== 'undefined'
          ? createPortal(
              <DropdownMenuTrigger asChild>
                <span
                  aria-hidden
                  tabIndex={-1}
                  className="pointer-events-none fixed size-0"
                  style={{ left: point.x, top: point.y }}
                />
              </DropdownMenuTrigger>,
              document.body,
            )
          : null}
        {children}
      </DropdownMenu>
    </ContextMenuContext.Provider>
  );
}

/**
 * Menus and dialogs opened from inside the trigger render in portals, but React
 * still bubbles their events to it. Only events from the trigger's own markup
 * may open this menu.
 */
function isInside(event: React.SyntheticEvent<HTMLElement>) {
  return (
    event.target instanceof Node && event.currentTarget.contains(event.target)
  );
}

type ContextMenuTriggerProps = React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean;
  disabled?: boolean;
};

/** The area that opens the menu. Pass `asChild` to use the child element itself. */
const ContextMenuTrigger = React.forwardRef<
  HTMLElement,
  ContextMenuTriggerProps
>(
  (
    {
      asChild = false,
      disabled = false,
      onContextMenu,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClickCapture,
      ...props
    },
    ref,
  ) => {
    const { openAt } = useContextMenuContext('ContextMenuTrigger');
    const press = React.useRef<{
      x: number;
      y: number;
      timer: ReturnType<typeof setTimeout>;
    } | null>(null);
    const openedByPress = React.useRef(false);

    const cancelPress = () => {
      if (press.current) clearTimeout(press.current.timer);
      press.current = null;
    };
    React.useEffect(() => cancelPress, []);

    const Component = asChild ? Slot : 'span';
    return (
      <Component
        ref={ref}
        {...props}
        onContextMenu={(event: React.MouseEvent<HTMLElement>) => {
          onContextMenu?.(event);
          if (disabled || event.defaultPrevented || !isInside(event)) return;
          event.preventDefault();
          cancelPress();
          // The Menu key and Shift+F10 report no pointer position.
          if (event.clientX === 0 && event.clientY === 0) {
            const rect = event.currentTarget.getBoundingClientRect();
            openAt(rect.left + 8, rect.top + 8);
          } else {
            openAt(event.clientX, event.clientY);
          }
        }}
        onPointerDown={(event: React.PointerEvent<HTMLElement>) => {
          onPointerDown?.(event);
          openedByPress.current = false;
          if (disabled || event.pointerType !== 'touch' || !isInside(event))
            return;
          cancelPress();
          const { clientX: x, clientY: y } = event;
          press.current = {
            x,
            y,
            timer: setTimeout(() => {
              press.current = null;
              openedByPress.current = true;
              openAt(x, y);
            }, LONG_PRESS_MS),
          };
        }}
        onPointerMove={(event: React.PointerEvent<HTMLElement>) => {
          onPointerMove?.(event);
          if (
            press.current &&
            Math.hypot(
              event.clientX - press.current.x,
              event.clientY - press.current.y,
            ) > LONG_PRESS_SLOP_PX
          )
            cancelPress();
        }}
        onPointerUp={(event: React.PointerEvent<HTMLElement>) => {
          onPointerUp?.(event);
          cancelPress();
        }}
        onPointerCancel={(event: React.PointerEvent<HTMLElement>) => {
          onPointerCancel?.(event);
          cancelPress();
        }}
        // Lifting the finger after a long-press must not also activate the row.
        onClickCapture={(event: React.MouseEvent<HTMLElement>) => {
          onClickCapture?.(event);
          if (!openedByPress.current) return;
          openedByPress.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      />
    );
  },
);
ContextMenuTrigger.displayName = 'ContextMenuTrigger';

/** The menu surface; fill it with `DropdownMenuItem`s and separators. */
const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuContent>
>(
  (
    {
      className,
      onCloseAutoFocus,
      onClick,
      onPointerDown,
      onContextMenu,
      ...props
    },
    ref,
  ) => {
    const { returnFocus } = useContextMenuContext('ContextMenuContent');
    return (
      <DropdownMenuContent
        ref={ref}
        align="start"
        side="bottom"
        sideOffset={2}
        collisionPadding={8}
        className={cn('min-w-48', className)}
        {...props}
        // The menu renders in a portal, but React still bubbles its events to
        // the trigger. A click on an item must not also open or drag the row.
        onClick={(event) => {
          onClick?.(event);
          event.stopPropagation();
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          event.stopPropagation();
        }}
        onContextMenu={(event) => {
          onContextMenu?.(event);
          event.preventDefault();
          event.stopPropagation();
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          returnFocus();
        }}
      />
    );
  },
);
ContextMenuContent.displayName = 'ContextMenuContent';

export { ContextMenu, ContextMenuTrigger, ContextMenuContent };
