import { Button } from './ui/button';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ChevronDown, Plus } from 'lucide-react';

import { ARRIVAL_CLASS, useArrivals } from '../hooks/use-arrivals';
import { cn } from '../lib/utils';
import { ErrorState } from './error-state';
import { Checkbox } from './ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from './ui/context-menu';
import { Skeleton } from './ui/skeleton';
import { Text } from './ui/text';

export type ListKey = string | number;

export type ListGroup<Row> = {
  key: string;
  title: ReactNode;
  icon?: ReactNode;
  rows: Row[];
};

export type ListViewProps<Row> = {
  /** Rows in groups, such as issues by status; one group without a title for a flat list. */
  groups: ListGroup<Row>[];
  rowKey: (row: Row) => ListKey;
  /** The row's accessible name, such as "OPS-12 Fix the login redirect". */
  rowLabel: (row: Row) => string;
  /** The row's cells after the checkbox. */
  renderRow: (row: Row) => ReactNode;
  /** Selected rows; a checkbox appears on each row when `onSelectedChange` is set. */
  selected?: ReadonlySet<ListKey>;
  onSelectedChange?: (selected: Set<ListKey>) => void;
  /** Opens a row: a click, or Enter on the focused row. */
  onOpen?: (row: Row) => void;
  rowHref?: (row: Row) => string;
  onRetry?: () => void;
  labels?: {
    select?: (name: string) => string;
    open?: (name: string) => string;
    expand?: string;
    collapse?: string;
    add?: (group: string) => string;
    retry?: string;
    retrying?: string;
  };
  /** All row content can be expanded without clipping, including on touch screens. */
  fullRow?: (row: Row) => ReactNode;
  /** The open row's key, such as the record shown beside the list; it is marked as current. */
  openKey?: ListKey | null;
  /** Reports the focused row, so page hotkeys such as S for status act on it. */
  onFocusedChange?: (row: Row | null) => void;
  /** Adds a row to a group; each group header shows a + button. */
  onAddToGroup?: (groupKey: string) => void;
  /** Menu items for a right-click or Shift+F10 on a row, such as `DropdownMenuItem`s. */
  rowMenu?: (row: Row) => ReactNode;
  /** Shown when no group has rows. */
  empty: ReactNode;
  loading?: boolean;
  error?: { message: string } | null;
  /** Opt in to Alt+J/K/X outside the list. Unmodified shortcuts stay inside the focused list. */
  pageHotkeys?: boolean;
};

function typingOrOverlay(target: EventTarget | null): boolean {
  if (
    document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')
  ) {
    return true;
  }
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

/**
 * A dense, grouped list in the style of Linear. J and K (or the arrow keys) move the focus, X
 * selects the focused row, Enter opens it, and a right-click or Shift+F10 opens `rowMenu`. Group headers
 * collapse and show their count.
 */
export function ListView<Row>({
  groups,
  rowKey,
  rowLabel,
  renderRow,
  selected,
  onSelectedChange,
  onOpen,
  rowHref,
  fullRow,
  onRetry,
  labels,
  openKey,
  onFocusedChange,
  onAddToGroup,
  rowMenu,
  empty,
  loading = false,
  error,
  pageHotkeys = false,
}: ListViewProps<Row>) {
  const listId = useId();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [focused, setFocused] = useState<ListKey | null>(null);
  const rowRefs = useRef(new Map<ListKey, HTMLDivElement>());
  const chosen = selected ?? new Set<ListKey>();
  const selectable = onSelectedChange !== undefined;

  const visible = groups.flatMap((group) =>
    collapsed.has(group.key) ? [] : group.rows,
  );
  const keys = visible.map(rowKey);
  const activeKey =
    focused !== null && keys.includes(focused) ? focused : (keys[0] ?? null);
  // Rows that load or arrive later ease in; the rows already shown stay put.
  const arrived = useArrivals(keys);
  const byKey = new Map(visible.map((row) => [rowKey(row), row]));

  // Keep the reported focus true when the focused row leaves the list.
  const focusedRow = focused === null ? undefined : byKey.get(focused);
  const lastReported = useRef<ListKey | null>(null);
  useEffect(() => {
    const key = focusedRow === undefined ? null : rowKey(focusedRow);
    if (key !== lastReported.current) {
      lastReported.current = key;
      onFocusedChange?.(focusedRow ?? null);
    }
  });

  function focusKey(key: ListKey) {
    setFocused(key);
    const row = rowRefs.current.get(key);
    const control =
      row?.querySelector<HTMLElement>('[data-row-open]') ??
      row?.querySelector<HTMLElement>('button, a, input');
    (control ?? row)?.focus();
  }

  function toggle(key: ListKey) {
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedChange?.(next);
  }

  function handleKey(key: string, preventDefault: () => void): boolean {
    if (keys.length === 0) return false;
    const index = focused === null ? -1 : keys.indexOf(focused);
    if (key === 'j' || key === 'ArrowDown') {
      preventDefault();
      focusKey(keys[Math.min(index + 1, keys.length - 1)]!);
      return true;
    }
    if (key === 'k' || key === 'ArrowUp') {
      preventDefault();
      focusKey(keys[Math.max(index - 1, 0)]!);
      return true;
    }
    if (focused === null || index === -1) return false;
    if (key === 'x' && selectable) {
      preventDefault();
      toggle(focused);
      return true;
    }
    if (key === 'Enter' && onOpen) {
      preventDefault();
      onOpen(byKey.get(focused)!);
      return true;
    }
    return false;
  }

  const handleKeyRef = useRef(handleKey);
  handleKeyRef.current = handleKey;
  useEffect(() => {
    if (!pageHotkeys) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        !event.altKey
      )
        return;
      if (typingOrOverlay(event.target)) return;
      // A focused control outside the list, such as a button or tabs, keeps Enter and the arrows.
      if (
        ['Enter', 'ArrowDown', 'ArrowUp'].includes(event.key) &&
        event.target instanceof Element &&
        event.target !== document.body &&
        !document.getElementById(listId)?.contains(event.target)
      ) {
        return;
      }
      // Keys inside the list are handled on the list itself.
      if (
        event.target instanceof Node &&
        document.getElementById(listId)?.contains(event.target)
      ) {
        return;
      }
      handleKeyRef.current(event.key, () => event.preventDefault());
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pageHotkeys, listId]);

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={onRetry}
        retrying={loading}
        labels={labels}
      />
    );
  }

  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <div
      id={listId}
      aria-busy={loading}
      data-testid="list-view"
      className="flex flex-col text-sm"
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        if (
          event.defaultPrevented ||
          event.nativeEvent.isComposing ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey
        )
          return;
        // A control inside a row, such as a property picker, keeps its own keys.
        if (
          event.target instanceof HTMLElement &&
          event.target.closest(
            'input, textarea, select, [contenteditable=true], button:not([data-row-open]), a:not([data-row-open])',
          )
        ) {
          return;
        }
        if (event.key !== 'Enter')
          handleKey(event.key, () => event.preventDefault());
      }}
    >
      {loading ? (
        Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex h-10 items-center gap-inline px-page"
          >
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))
      ) : total === 0 ? (
        typeof empty === 'string' ? (
          <Text
            size="sm"
            variant="muted"
            className="px-page py-section text-center"
          >
            {empty}
          </Text>
        ) : (
          empty
        )
      ) : (
        groups.map((group) => {
          if (group.rows.length === 0) return null;
          const isCollapsed = collapsed.has(group.key);
          const titleId = `${listId}-${group.key}`;
          return (
            <section
              key={group.key}
              aria-labelledby={group.title ? titleId : undefined}
              data-testid="list-group"
            >
              {group.title !== undefined && group.title !== '' && (
                <header className="sticky top-0 z-10 flex h-9 items-center gap-inline bg-muted/70 px-page backdrop-blur-sm">
                  <Button variant="plain" size={null}
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-label={
                      isCollapsed
                        ? (labels?.expand ?? 'Expand group')
                        : (labels?.collapse ?? 'Collapse group')
                    }
                    className="-ml-1 flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent"
                    onClick={() =>
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (next.has(group.key)) next.delete(group.key);
                        else next.add(group.key);
                        return next;
                      })
                    }
                  >
                    <ChevronDown
                      className={cn(
                        'size-3.5 transition-transform duration-fast',
                        isCollapsed && '-rotate-90',
                      )}
                    />
                  </Button>
                  {group.icon && (
                    <span aria-hidden="true" className="flex [&_svg]:size-4">
                      {group.icon}
                    </span>
                  )}
                  <span id={titleId} className="font-medium text-foreground">
                    {group.title}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {group.rows.length}
                  </span>
                  {onAddToGroup && (
                    <Button variant="plain" size={null}
                      type="button"
                      aria-label={
                        labels?.add?.(
                          typeof group.title === 'string'
                            ? group.title
                            : group.key,
                        ) ??
                        `Add to ${typeof group.title === 'string' ? group.title : group.key}`
                      }
                      className="ml-auto flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() => onAddToGroup(group.key)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  )}
                </header>
              )}
              {!isCollapsed && (
                <ul>
                  {group.rows.map((row) => {
                    const key = rowKey(row);
                    const isChosen = chosen.has(key);
                    const isFocused = activeKey === key;
                    const isOpen =
                      openKey !== undefined &&
                      openKey !== null &&
                      openKey === key;
                    const line = (
                      <div
                        ref={(node) => {
                          if (node) rowRefs.current.set(key, node);
                          else rowRefs.current.delete(key);
                        }}
                        data-list-row=""
                        data-testid="list-row"
                        data-focused={isFocused || undefined}
                        data-state={isChosen ? 'selected' : undefined}
                        tabIndex={-1}
                        data-open={isOpen || undefined}
                        aria-current={isOpen || undefined}
                        className={cn(
                          'group/row flex h-11 cursor-default items-center gap-inline border-b border-border/60 px-page outline-none transition-colors duration-fast',
                          onOpen && 'cursor-pointer',
                          'hover:bg-muted/60 data-[focused]:bg-muted data-[state=selected]:bg-accent/60',
                          'relative before:absolute before:inset-y-0 before:left-0 before:w-0.5 data-[open]:bg-accent data-[open]:before:bg-primary',
                        )}
                        onFocus={() => setFocused(key)}
                        onClick={(event) => {
                          if (
                            !event.currentTarget.contains(event.target as Node)
                          )
                            return;
                          if (
                            (event.target as Element).closest(
                              'button, a, input, select, textarea, summary, [contenteditable="true"]',
                            )
                          )
                            return;
                          setFocused(key);
                          if (!rowHref) onOpen?.(row);
                        }}
                      >
                        {selectable && (
                          <span
                            className="flex w-5 shrink-0 justify-center"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Checkbox
                              aria-label={
                                labels?.select?.(rowLabel(row)) ??
                                `Select ${rowLabel(row)}`
                              }
                              checked={isChosen}
                              onCheckedChange={() => toggle(key)}
                            />
                          </span>
                        )}
                        {renderRow(row)}
                        {rowHref ? (
                          <a
                            data-row-open=""
                            href={rowHref(row)}
                            aria-label={
                              labels?.open?.(rowLabel(row)) ??
                              `Open ${rowLabel(row)}`
                            }
                            className="ml-auto flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-sm underline focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            ↗
                          </a>
                        ) : onOpen ? (
                          <Button variant="plain" size={null}
                            type="button"
                            data-row-open=""
                            onClick={() => onOpen(row)}
                            aria-label={
                              labels?.open?.(rowLabel(row)) ??
                              `Open ${rowLabel(row)}`
                            }
                            className="ml-auto flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-sm underline focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            ↗
                          </Button>
                        ) : null}
                        {fullRow && (
                          <Collapsible
                            className="relative"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="plain"
                                size={null}
                                className="min-h-6 min-w-6"
                                aria-label={rowLabel(row)}
                              >
                                …
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="absolute right-0 z-20 w-72 max-w-[80vw] whitespace-normal break-words rounded-md border bg-popover p-inset text-foreground shadow-md">
                              {fullRow(row)}
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    );
                    return (
                      <li
                        key={key}
                        className={arrived(key) ? ARRIVAL_CLASS : undefined}
                      >
                        {rowMenu ? (
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              {line}
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56">
                              {rowMenu(row)}
                            </ContextMenuContent>
                          </ContextMenu>
                        ) : (
                          line
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
