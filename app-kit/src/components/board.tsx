import { Button } from './ui/button';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

import { MEDIA_QUERIES_BELOW } from '../lib/breakpoints';
import { cn } from '../lib/utils';
import { ErrorState } from './error-state';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { STATUS_DOT_TONES, type StatusDotTone } from './status-dot';
import { ScrollFade } from './ui/scroll-fade';
import { Skeleton } from './ui/skeleton';
import { Text } from './ui/text';

export type BoardKey = string | number;

export type BoardColumn = {
  id: string;
  title: string;
  /** The dot before the title: the tone the same value has in its `StatusDot`. */
  tone?: StatusDotTone;
};

/** Where a card goes: its column, the card it now sits before, and a position between its neighbours. */
export type BoardMove = {
  key: BoardKey;
  toColumn: string;
  /** The card it sits before; `null` at the end of the column. */
  beforeKey: BoardKey | null;
  /** Write this to the item's position column to keep the order. */
  position: number;
};

export type BoardProps<Item> = {
  columns: BoardColumn[];
  items: Item[] | undefined;
  itemKey: (item: Item) => BoardKey;
  columnOf: (item: Item) => string;
  /** The order of cards in a column, smallest first; the order of `items` when omitted. */
  positionOf?: (item: Item) => number;
  /** A short name for announcements, such as the card title. */
  itemLabel?: (item: Item) => string;
  renderCard: (item: Item) => ReactNode;
  onMove?: (move: BoardMove) => void;
  onCardClick?: (item: Item) => void;
  /** Below a column's cards, such as an add button. */
  columnFooter?: (column: BoardColumn) => ReactNode;
  /** At the end of a column's header, such as a + button that adds a card to it. */
  columnAction?: (column: BoardColumn) => ReactNode;
  /** A total after the count, from the column's cards, such as the sum of order values. */
  columnSummary?: (column: BoardColumn, items: Item[]) => ReactNode;
  emptyColumn?: ReactNode;
  loading?: boolean;
  /** Shown instead of the board. */
  error?: { message: string } | null;
  onRetry?: () => void;
  labels?: {
    columns?: string;
    instructions?: string;
    move?: (name: string) => string;
    moveTo?: (column: string) => string;
    up?: string;
    down?: string;
    moved?: (name: string, column: string, position: number) => string;
    retry?: string;
    retrying?: string;
  };
};

const GAP = 1024;

/** A position between two neighbours; either may be missing at the start or end of a column. */
export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return GAP;
  if (before === undefined) return after! - GAP;
  if (after === undefined) return before + GAP;
  return (before + after) / 2;
}

const COLUMN_ID = 'column:';
const PICKER_ID = 'picker:';
const CARD_ID = 'card:';

function Card<Item>({
  item,
  id,
  instructions,
  onOpen,
  onKeyMove,
  settling,
  onSettled,
  children,
  label,
  actions,
  cardRef,
}: {
  item: Item;
  id: BoardKey;
  instructions: string;
  label: string;
  actions?: ReactNode;
  cardRef: (node: HTMLDivElement | null) => void;
  onOpen?: (item: Item) => void;
  onKeyMove: (event: KeyboardEvent<HTMLDivElement>) => void;
  /** The card just landed here, so it settles into place. */
  settling: boolean;
  onSettled: () => void;
  children: ReactNode;
}) {
  const drag = useDraggable({ id: `${CARD_ID}${id}` });
  const drop = useDroppable({ id: `${CARD_ID}${id}` });
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
        cardRef(node);
      }}
      {...drag.listeners}
      role="group"
      aria-label={label}
      tabIndex={0}
      aria-describedby={instructions}
      data-testid="board-card"
      className={cn(
        'touch-manipulation rounded-md border bg-card p-inset text-left text-sm text-foreground outline-none transition-shadow duration-fast ease-move hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring',
        onOpen && 'cursor-pointer',
        drag.isDragging && 'opacity-40',
        drop.isOver && !drag.isDragging && 'ring-2 ring-primary/40',
        settling &&
          'animate-in fade-in-0 zoom-in-95 duration-normal ease-spring',
      )}
      onAnimationEnd={settling ? onSettled : undefined}
      onClick={
        onOpen
          ? (event) => {
              if (!event.currentTarget.contains(event.target as Node)) return;
              if (
                (event.target as Element).closest(
                  'button, a, input, select, textarea, summary, [role="button"], [role="checkbox"], [contenteditable="true"]',
                )
              )
                return;
              onOpen(item);
            }
          : undefined
      }
      onKeyDown={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        if (
          event.target !== event.currentTarget &&
          !(event.target as Element).closest('[data-card-open]')
        )
          return;
        if (
          event.key === 'Enter' &&
          onOpen &&
          event.target === event.currentTarget
        ) {
          event.preventDefault();
          onOpen(item);
          return;
        }
        onKeyMove(event);
      }}
    >
      {children}
      <div
        className="mt-inline flex items-center justify-end gap-inline"
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        {onOpen && (
          <Button variant="plain" size={null}
            type="button"
            data-card-open=""
            aria-label={label}
            onClick={() => onOpen(item)}
            className="min-h-6 min-w-6 rounded-sm underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            ↗
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}

function Column({
  column,
  count,
  children,
  footer,
  action,
  summary,
}: {
  column: BoardColumn;
  count: number;
  children: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
  summary?: ReactNode;
}) {
  const titleId = useId();
  const { setNodeRef, isOver } = useDroppable({
    id: `${COLUMN_ID}${column.id}`,
  });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={titleId}
      data-testid="board-column"
      className={cn(
        'flex max-w-80 flex-[1_0_12rem] flex-col gap-1.5 rounded-lg max-mobile:max-w-none p-1.5 transition-colors duration-fast',
        isOver && 'bg-accent',
      )}
    >
      <header className="group/column relative flex h-7 items-center gap-inline px-1">
        {column.tone && (
          <span
            aria-hidden="true"
            className={cn(
              'size-2 shrink-0 rounded-full',
              STATUS_DOT_TONES[column.tone],
            )}
          />
        )}
        <Text id={titleId} size="sm" weight="medium">
          {column.title}
        </Text>
        <Text size="xs" variant="muted" className="tabular-nums">
          {count}
        </Text>
        {summary !== undefined && (
          <Text size="xs" variant="muted" className="truncate tabular-nums">
            {summary}
          </Text>
        )}
        {/* Shown on hover, so the header keeps its sum at rest; a touch screen has no hover. */}
        {action && (
          <div className="absolute right-0 flex bg-background opacity-0 focus-within:opacity-100 group-hover/column:opacity-100 max-mobile:static max-mobile:ml-auto max-mobile:bg-transparent max-mobile:opacity-100 pointer-coarse:opacity-100">
            {action}
          </div>
        )}
      </header>
      <div className="flex min-h-16 flex-col gap-1.5">{children}</div>
      {footer}
    </section>
  );
}

const PHONE = MEDIA_QUERIES_BELOW.mobile;

function subscribeToPhone(onChange: () => void) {
  const query = window.matchMedia?.(PHONE);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

function usePhone() {
  return useSyncExternalStore(
    subscribeToPhone,
    () => window.matchMedia?.(PHONE).matches ?? false,
  );
}

/** Shows one column on a phone. A card dropped here moves to that column. */
function ColumnPicker({
  column,
  count,
  selected,
  onSelect,
}: {
  column: BoardColumn;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${PICKER_ID}${column.id}`,
  });
  return (
    <Button variant="plain" size={null}
      ref={setNodeRef}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-md px-inline text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'bg-muted font-medium' : 'text-muted-foreground',
        isOver && 'bg-accent',
      )}
    >
      {column.tone && (
        <span
          aria-hidden="true"
          className={cn(
            'size-2 shrink-0 rounded-full',
            STATUS_DOT_TONES[column.tone],
          )}
        />
      )}
      {column.title}
      <Text as="span" size="xs" variant="muted" className="tabular-nums">
        {count}
      </Text>
    </Button>
  );
}

/**
 * Cards in columns, such as orders by status; on a phone one column shows at a time, with a picker above it. Drag a card with the pointer, or focus it and press Alt
 * with an arrow key: left and right change the column, up and down change the order. `onMove`
 * reports the new column and position; the caller saves them, for example with `useUpdateRow`.
 */
export function Board<Item>({
  columns,
  items,
  itemKey,
  columnOf,
  positionOf,
  itemLabel,
  renderCard,
  onMove,
  onCardClick,
  columnFooter,
  columnAction,
  columnSummary,
  emptyColumn = 'No cards',
  loading = false,
  error,
  onRetry,
  labels,
}: BoardProps<Item>) {
  const instructions = useId();
  const menuMove = useRef<BoardKey | null>(null);
  const cardRefs = useRef(new Map<BoardKey, HTMLDivElement>());
  const focusAfterMove = useRef<{
    key: BoardKey;
    column: string;
    position: number;
  } | null>(null);
  const [active, setActive] = useState<BoardKey | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [settling, setSettling] = useState<BoardKey | null>(null);
  const phone = usePhone();
  const [phoneColumn, setPhoneColumn] = useState<string | null>(null);
  useLayoutEffect(() => {
    const request = focusAfterMove.current;
    if (!request) return;
    const item = items?.find((each) => itemKey(each) === request.key);
    if (
      !item ||
      columnOf(item) !== request.column ||
      (positionOf && positionOf(item) !== request.position)
    )
      return;
    if (phone && phoneColumn !== request.column) {
      setPhoneColumn(request.column);
      return;
    }
    const card = cardRefs.current.get(request.key);
    if (!card) return;
    (card.querySelector<HTMLElement>('[data-card-open]') ?? card).focus();
    focusAfterMove.current = null;
  });
  const sensors = useSensors(
    // A short drag distance keeps a click a click.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // A touch drags after a hold; a swipe scrolls the page.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

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

  const list = items ?? [];
  const order = new Map(list.map((item, index) => [itemKey(item), index]));
  const positionOfItem = (item: Item) =>
    positionOf ? positionOf(item) : order.get(itemKey(item))!;
  const grouped = new Map<string, Item[]>();
  for (const item of list) {
    const column = columnOf(item);
    const cards = grouped.get(column) ?? [];
    cards.push(item);
    grouped.set(column, cards);
  }
  for (const cards of grouped.values())
    cards.sort((a, b) => positionOfItem(a) - positionOfItem(b));
  const cardsIn = (columnId: string) => grouped.get(columnId) ?? [];
  const byKey = new Map(list.map((item) => [String(itemKey(item)), item]));
  const labelOf = (item: Item) => itemLabel?.(item) ?? String(itemKey(item));

  function move(item: Item, toColumn: string, beforeKey: BoardKey | null) {
    const key = itemKey(item);
    const others = cardsIn(toColumn).filter((card) => itemKey(card) !== key);
    const at =
      beforeKey === null
        ? others.length
        : others.findIndex((card) => itemKey(card) === beforeKey);
    const index = at === -1 ? others.length : at;
    const from = cardsIn(toColumn).findIndex((card) => itemKey(card) === key);
    if (from === index) return;
    const before = others[index - 1];
    const after = others[index];
    const position = positionBetween(
      before === undefined ? undefined : positionOfItem(before),
      after === undefined ? undefined : positionOfItem(after),
    );
    const title =
      columns.find((column) => column.id === toColumn)?.title ?? toColumn;
    setAnnouncement(
      labels?.moved?.(labelOf(item), title, index + 1) ??
        `Moved ${labelOf(item)} to ${title}, position ${index + 1}.`,
    );
    focusAfterMove.current = { key, column: toColumn, position };
    setSettling(key);
    onMove?.({
      key,
      toColumn,
      beforeKey: after ? itemKey(after) : null,
      position,
    });
  }

  function onDragStart(event: DragStartEvent) {
    const item = byKey.get(String(event.active.id).slice(CARD_ID.length));
    setActive(item ? itemKey(item) : null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActive(null);
    const item = byKey.get(String(event.active.id).slice(CARD_ID.length));
    const over = event.over ? String(event.over.id) : null;
    if (!item || over === null || over === String(event.active.id)) return;
    if (over.startsWith(PICKER_ID)) {
      move(item, over.slice(PICKER_ID.length), null);
      return;
    }
    if (over.startsWith(COLUMN_ID)) {
      // A drop on a column's background puts the card at the end of that column.
      move(item, over.slice(COLUMN_ID.length), null);
      return;
    }
    const target = byKey.get(over.slice(CARD_ID.length));
    if (!target) return;
    // Over the lower half of a card, the dragged card goes after it.
    const dragged = event.active.rect.current.translated;
    const targetRect = event.over!.rect;
    const after =
      dragged !== null &&
      dragged.top + dragged.height / 2 > targetRect.top + targetRect.height / 2;
    if (!after) {
      move(item, columnOf(target), itemKey(target));
      return;
    }
    const cards = cardsIn(columnOf(target)).filter(
      (card) => itemKey(card) !== itemKey(item),
    );
    const next = cards[cards.indexOf(target) + 1];
    move(item, columnOf(target), next === undefined ? null : itemKey(next));
  }

  function keyMove(item: Item, event: KeyboardEvent<HTMLDivElement>) {
    if (!event.altKey || !onMove) return;
    const columnIds = columns.map((column) => column.id);
    const columnIndex = columnIds.indexOf(columnOf(item));
    const cards = cardsIn(columnOf(item));
    const index = cards.findIndex((card) => itemKey(card) === itemKey(item));
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const next =
        columnIds[columnIndex + (event.key === 'ArrowLeft' ? -1 : 1)];
      if (next === undefined) return;
      event.preventDefault();
      move(item, next, null);
    } else if (event.key === 'ArrowUp' && index > 0) {
      event.preventDefault();
      move(item, columnOf(item), itemKey(cards[index - 1]!));
    } else if (event.key === 'ArrowDown' && index < cards.length - 1) {
      event.preventDefault();
      move(
        item,
        columnOf(item),
        cards[index + 2] ? itemKey(cards[index + 2]!) : null,
      );
    }
  }

  const activeItem = active === null ? undefined : byKey.get(String(active));

  const selectedColumn = columns.some((column) => column.id === phoneColumn)
    ? phoneColumn
    : columns[0]?.id;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      {phone && (
        <div className="flex flex-wrap gap-1 pb-inline">
          {columns.map((column) => (
            <ColumnPicker
              key={column.id}
              column={column}
              count={cardsIn(column.id).length}
              selected={column.id === selectedColumn}
              onSelect={() => setPhoneColumn(column.id)}
            />
          ))}
        </div>
      )}
      <ScrollFade
        role="region"
        aria-busy={loading}
        aria-label={labels?.columns ?? 'Columns'}
        className="flex gap-stack pb-inline"
      >
        {columns
          .filter((column) => !phone || column.id === selectedColumn)
          .map((column) => {
            const cards = cardsIn(column.id);
            return (
              <Column
                key={column.id}
                column={column}
                count={cards.length}
                footer={columnFooter?.(column)}
                action={columnAction?.(column)}
                summary={loading ? undefined : columnSummary?.(column, cards)}
              >
                {loading ? (
                  <>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </>
                ) : cards.length === 0 ? (
                  <Text size="sm" variant="muted" className="px-1 py-inline">
                    {emptyColumn}
                  </Text>
                ) : (
                  cards.map((item) => (
                    <Card
                      key={itemKey(item)}
                      item={item}
                      id={itemKey(item)}
                      instructions={instructions}
                      label={labelOf(item)}
                      cardRef={(node) => {
                        if (node) cardRefs.current.set(itemKey(item), node);
                        else cardRefs.current.delete(itemKey(item));
                      }}
                      actions={
                        onMove && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="plain" size={null}
                                type="button"
                                aria-label={
                                  labels?.move?.(labelOf(item)) ??
                                  `Move ${labelOf(item)}`
                                }
                                className="min-h-6 rounded-sm px-2 text-xs underline focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {labels?.move?.(labelOf(item)) ?? 'Move…'}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              onCloseAutoFocus={(event) => {
                                if (menuMove.current !== null) {
                                  event.preventDefault();
                                  const card = cardRefs.current.get(
                                    menuMove.current,
                                  );
                                  (
                                    card?.querySelector<HTMLElement>(
                                      '[data-card-open]',
                                    ) ?? card
                                  )?.focus();
                                  menuMove.current = null;
                                }
                              }}
                            >
                              {columns
                                .filter((each) => each.id !== column.id)
                                .map((each) => (
                                  <DropdownMenuItem
                                    key={each.id}
                                    onSelect={() => {
                                      menuMove.current = itemKey(item);
                                      move(item, each.id, null);
                                    }}
                                  >
                                    {labels?.moveTo?.(each.title) ??
                                      `Move to ${each.title}`}
                                  </DropdownMenuItem>
                                ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={cards[0] === item}
                                onSelect={() => {
                                  menuMove.current = itemKey(item);
                                  move(
                                    item,
                                    column.id,
                                    itemKey(cards[cards.indexOf(item) - 1]!),
                                  );
                                }}
                              >
                                {labels?.up ?? 'Move up'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={cards[cards.length - 1] === item}
                                onSelect={() => {
                                  menuMove.current = itemKey(item);
                                  move(
                                    item,
                                    column.id,
                                    cards[cards.indexOf(item) + 2]
                                      ? itemKey(cards[cards.indexOf(item) + 2]!)
                                      : null,
                                  );
                                }}
                              >
                                {labels?.down ?? 'Move down'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )
                      }
                      onOpen={onCardClick}
                      onKeyMove={(event) => keyMove(item, event)}
                      settling={settling === itemKey(item)}
                      onSettled={() => setSettling(null)}
                    >
                      {renderCard(item)}
                    </Card>
                  ))
                )}
              </Column>
            );
          })}
      </ScrollFade>
      <p id={instructions} className="sr-only">
        {onMove
          ? (labels?.instructions ??
            'Use the Move menu, or press Alt with Left or Right to change column and Up or Down to change order.')
          : ''}
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {/* No drop animation: it flies to where the card was before the move, not where it lands. */}
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="rotate-1 rounded-md border bg-card p-inset text-sm text-foreground shadow-lg">
            {renderCard(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
