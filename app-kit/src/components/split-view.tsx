import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

import { useBreakpointBelow } from '../hooks/use-breakpoint';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

export type SplitViewProps = {
  /** The records to choose from, such as a `ListView` or a `ul`. */
  list: ReactNode;
  /** The list pane's accessible name, such as "Tickets". */
  listLabel: string;
  /** The open record; `null` or `undefined` while none is open. */
  detail?: ReactNode;
  /** The open record's name, such as a ticket's subject: the detail pane's accessible name. */
  detailLabel?: string;
  /** The open record's key, so each record opens at the top of its pane. */
  detailKey?: string | number;
  /** Closes the record: the phone's Back button calls it. */
  onBack: () => void;
  /** The Back button's text. */
  backLabel?: string;
  /**
   * Fills the detail pane from `half` up while no record is open, such as an `EmptyState`. Without
   * it the list takes the full width until a record opens.
   */
  placeholder?: ReactNode;
  className?: string;
};

/**
 * A list and the record opened from it, side by side from the `half` breakpoint, each pane
 * scrolling on its own. On a phone the record replaces the list, with a Back button above it, and
 * Back returns the focus to the list.
 */
export function SplitView({
  list,
  listLabel,
  detail,
  detailLabel,
  detailKey,
  onBack,
  backLabel = 'Back',
  placeholder,
  className,
}: SplitViewProps) {
  const open = detail !== null && detail !== undefined && detail !== false;
  const split = open || placeholder !== undefined;
  const phone = useBreakpointBelow('half');
  const listRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const wentBack = useRef(false);
  const origin = useRef<HTMLElement | null>(null);
  const scrollTop = useRef(0);

  // On a phone the pane that appears takes the focus, as the one that held it is now hidden.
  useEffect(() => {
    if (!phone) return;
    if (open) {
      detailRef.current?.focus({ preventScroll: true });
    } else if (wentBack.current) {
      const target = origin.current?.isConnected
        ? origin.current
        : listRef.current;
      target?.focus({ preventScroll: true });
      if (listRef.current) listRef.current.scrollTop = scrollTop.current;
    }
    wentBack.current = false;
  }, [phone, open, detailKey]);

  return (
    <div className={cn('flex h-full min-h-0', className)}>
      <div
        ref={listRef}
        onFocusCapture={(event) => {
          if (!open) {
            origin.current = event.target;
            scrollTop.current = event.currentTarget.scrollTop;
          }
        }}
        onScroll={(event) => {
          if (!open) scrollTop.current = event.currentTarget.scrollTop;
        }}
        role="region"
        aria-label={listLabel}
        tabIndex={-1}
        className={cn(
          'min-h-0 min-w-0 flex-[2] overflow-y-auto outline-none',
          split && 'half:max-w-md half:border-r',
          open && 'max-half:hidden',
        )}
      >
        {list}
      </div>
      {open ? (
        <section
          key={detailKey}
          ref={detailRef}
          aria-label={detailLabel}
          tabIndex={0}
          className="flex min-h-0 min-w-0 flex-[3] flex-col overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <div className="sticky top-0 z-10 shrink-0 border-b bg-background px-page py-1 half:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 max-mobile:h-11"
              onClick={() => {
                wentBack.current = true;
                onBack();
              }}
            >
              <ArrowLeft />
              {backLabel}
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{detail}</div>
        </section>
      ) : (
        placeholder !== undefined && (
          <div className="hidden min-h-0 min-w-0 flex-[3] flex-col items-center justify-center overflow-y-auto half:flex">
            {placeholder}
          </div>
        )
      )}
    </div>
  );
}
