import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';

import { cn } from '../lib/utils';
import { ErrorState, type ErrorStateProps } from './error-state';
import { Skeleton } from './ui/skeleton';
import { Text } from './ui/text';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';

export type CardGridKey = string | number;

export type CardGridImage = { src: string; alt: string };

export type CardGridProps<Row> = {
  rows: Row[] | undefined;
  rowKey: (row: Row) => CardGridKey;
  /** The card's title and its accessible name, such as a product's name. */
  title: (row: Row) => string;
  /** One muted line under the title, such as "WD-1001 · Furniture". */
  meta?: (row: Row) => ReactNode;
  /**
   * The picture in the card's media box. Without one, or when it does not load, the box shows
   * `fallback` on a tint.
   */
  image?: (row: Row) => CardGridImage | null | undefined;
  /** What the media box shows without a picture, such as a category icon; the title's initials by default. */
  fallback?: (row: Row) => ReactNode;
  /**
   * The fallback's colour: a number picks one of the five chart colours in turn, such as a
   * category's index, so up to five categories never share one; a string, such as a category,
   * always gets the same colour. The title by default.
   */
  tint?: (row: Row) => number | string;
  /** A small label on the media box's corner, such as `<Badge>Draft</Badge>`. */
  badge?: (row: Row) => ReactNode;
  /** The start of the card's last line, such as a `StatusDot`. */
  status?: (row: Row) => ReactNode;
  /** The end of the card's last line, such as a price. */
  figure?: (row: Row) => ReactNode;
  /** Opens a card: a click, or Enter or Space on the focused card. */
  onOpen?: (row: Row) => void;
  /**
   * Makes each card a link to this address, so it opens in a new tab too. A plain click calls
   * `onOpen` instead of following it, when `onOpen` is set.
   */
  href?: (row: Row) => string;
  /** The open card, such as the record shown in a dialog; it shows a ring and `aria-current`. */
  selected?: CardGridKey | null;
  /** Bulk selection, independent of the open/current record. */
  selectedKeys?: ReadonlySet<CardGridKey>;
  onSelectedKeysChange?: (keys: Set<CardGridKey>) => void;
  /** Independent controls; never nested inside the primary record link/button. */
  actions?: (row: Row) => ReactNode;
  /** Rich preview content below the primary record control. */
  preview?: (row: Row) => ReactNode;
  density?: 'default' | 'compact';
  /** The grid's accessible name, such as "Products". */
  label: string;
  /** Shown in place of the grid when there are no rows. */
  empty: ReactNode;
  /** Cards on the grid stay while new ones load; with no rows, skeleton cards appear after a short wait. */
  loading?: boolean;
  /** Shown instead of the grid. */
  error?: { message: string } | null;
  onRetry?: () => void;
  labels?: ErrorStateProps['labels'] & { select?: (name: string) => string };
  /** The media box's shape; `none` leaves it out. */
  aspect?: 'landscape' | 'square' | 'none';
  /** The narrowest a card gets before the grid drops a column, from a large phone up. */
  minCardWidth?: string;
};

const LOADING_CARDS = 8;
const SKELETON_DELAY_MS = 300;
const TINTS = [
  'bg-chart-1/15 text-foreground',
  'bg-chart-2/15 text-foreground',
  'bg-chart-3/15 text-foreground',
  'bg-chart-4/15 text-foreground',
  'bg-chart-5/15 text-foreground',
];
const ASPECT = {
  landscape: 'mobile:aspect-[4/3]',
  square: 'mobile:aspect-square',
} as const;

/** True once `on` has held for `delay` ms, so a quick load shows no flash. */
function useAfterDelay(on: boolean, delay: number): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!on) {
      setLate(false);
      return;
    }
    const timer = setTimeout(() => setLate(true), delay);
    return () => clearTimeout(timer);
  }, [on, delay]);
  return on && late;
}

/** The same tint for the same value on every render and every device. */
function tintOf(value: number | string): string {
  let index = 0;
  if (typeof value === 'number') index = Math.abs(Math.trunc(value));
  else
    for (const char of value) index = (index * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[index % TINTS.length]!;
}

function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

function Media({
  image,
  fallback,
  tint,
  aspect,
}: {
  image: CardGridImage | null | undefined;
  fallback: ReactNode;
  tint: number | string;
  aspect: 'landscape' | 'square';
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image?.src]);
  const showImage = image && !failed;
  return (
    <span
      className={cn(
        // On a phone the media is a thumbnail beside the text, so a column of cards stays scannable.
        'relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md mobile:size-auto mobile:w-full mobile:rounded-none',
        ASPECT[aspect],
        showImage ? 'bg-muted' : tintOf(tint),
      )}
    >
      {showImage ? (
        <img
          src={image.src}
          alt={image.alt}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-slow ease-move motion-safe:group-hover/card:scale-[1.03]"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex items-center justify-center text-lg font-semibold mobile:text-2xl [&_svg]:size-6 mobile:[&_svg]:size-10"
        >
          {fallback}
        </span>
      )}
    </span>
  );
}

function SkeletonCard({
  aspect,
}: {
  aspect: CardGridProps<unknown>['aspect'];
}) {
  return (
    <li className="flex gap-inset overflow-hidden rounded-lg border bg-card max-mobile:p-inset mobile:flex-col mobile:gap-0">
      {aspect !== 'none' && (
        <Skeleton
          className={cn(
            'size-20 shrink-0 mobile:size-auto mobile:w-full mobile:rounded-none',
            ASPECT[aspect ?? 'landscape'],
          )}
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-inline mobile:p-inset">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <span className="flex justify-between gap-inline pt-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </span>
      </span>
    </li>
  );
}

/**
 * Records as cards in a responsive grid: one column of compact cards on a phone, as many columns
 * as fit from a large phone up. A primary button or link presents the record; selection, actions
 * and rich previews are independent siblings.
 */
export function CardGrid<Row>({
  rows,
  rowKey,
  title,
  meta,
  image,
  fallback,
  tint,
  badge,
  status,
  figure,
  onOpen,
  href,
  selected,
  selectedKeys,
  onSelectedKeysChange,
  actions,
  preview,
  density = 'default',
  label,
  empty,
  loading = false,
  error,
  onRetry,
  labels,
  aspect = 'landscape',
  minCardWidth,
}: CardGridProps<Row>) {
  const id = useId();
  const noRows = rows === undefined || rows.length === 0;
  const waiting = loading && noRows;
  const showSkeleton = useAfterDelay(waiting, SKELETON_DELAY_MS);

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

  if (noRows && !waiting) {
    return (
      <div data-testid="card-grid-empty">
        {typeof empty === 'string' ? (
          <Text
            size="sm"
            variant="muted"
            className="px-page py-section text-center"
          >
            {empty}
          </Text>
        ) : (
          empty
        )}
      </div>
    );
  }

  const columns = {
    '--card-grid-min':
      minCardWidth ?? (density === 'compact' ? '11rem' : '14rem'),
  } as CSSProperties;

  const toggle = (key: CardGridKey, checked: boolean) => {
    const next = new Set(selectedKeys);
    if (checked) next.add(key);
    else next.delete(key);
    onSelectedKeysChange?.(next);
  };

  return (
    <ul
      aria-label={label}
      aria-busy={loading}
      data-testid="card-grid"
      style={columns}
      className="grid grid-cols-1 gap-inset mobile:grid-cols-[repeat(auto-fill,minmax(min(var(--card-grid-min),100%),1fr))] mobile:gap-stack"
    >
      {waiting
        ? showSkeleton &&
          Array.from({ length: LOADING_CARDS }, (_, index) => (
            <SkeletonCard key={index} aspect={aspect} />
          ))
        : rows!.map((row) => {
            const key = rowKey(row);
            const name = title(row);
            const titleId = `${id}-${key}-title`;
            const detailsId = `${id}-${key}-details`;
            const isSelected =
              selected !== undefined && selected !== null && selected === key;
            const metaLine = meta?.(row);
            const statusLine = status?.(row);
            const figureLine = figure?.(row);
            const badgeLine = badge?.(row);
            const link = href?.(row);
            const checked = selectedKeys?.has(key) ?? false;
            const cardActions = actions?.(row);
            const cardPreview = preview?.(row);
            const interactive = link !== undefined || onOpen !== undefined;
            const content = (
              <>
                {aspect !== 'none' && (
                  <Media
                    image={image?.(row)}
                    fallback={fallback ? fallback(row) : initials(name)}
                    tint={tint ? tint(row) : name}
                    aspect={aspect}
                  />
                )}
                <span
                  className={cn(
                    'flex min-w-0 flex-1 flex-col gap-1',
                    density === 'compact'
                      ? 'mobile:p-inline'
                      : 'mobile:p-inset',
                  )}
                >
                  <Text
                    as="span"
                    id={titleId}
                    size="sm"
                    weight="medium"
                    className="line-clamp-2 break-words"
                  >
                    {name}
                  </Text>
                  <span
                    id={detailsId}
                    className="flex min-w-0 flex-1 flex-col gap-1"
                  >
                    {(metaLine || badgeLine) && (
                      <span className="flex min-w-0 items-center gap-inline">
                        {badgeLine && (
                          // From a large phone up the badge sits on the media's corner; it stays in the
                          // card's description either way.
                          <span
                            className={cn(
                              'flex shrink-0',
                              aspect !== 'none' &&
                                'mobile:absolute mobile:left-inline mobile:top-inline',
                            )}
                          >
                            {badgeLine}
                          </span>
                        )}
                        {metaLine && (
                          <Text
                            as="span"
                            size="xs"
                            variant="muted"
                            className="min-w-0 truncate"
                          >
                            {metaLine}
                          </Text>
                        )}
                      </span>
                    )}
                    {(statusLine || figureLine) && (
                      <span className="mt-auto flex min-w-0 items-center justify-between gap-inline pt-1">
                        <span className="min-w-0 truncate">{statusLine}</span>
                        {figureLine !== undefined && figureLine !== null && (
                          <Text
                            as="span"
                            size="sm"
                            weight="semibold"
                            className="shrink-0 tabular-nums"
                          >
                            {figureLine}
                          </Text>
                        )}
                      </span>
                    )}
                  </span>
                </span>
              </>
            );
            const cardClass = cn(
              'group/card relative flex h-full w-full justify-start gap-inset whitespace-normal p-0 text-left text-foreground max-mobile:p-inset mobile:flex-col mobile:gap-0',
              interactive &&
                'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring hover:bg-muted/50',
            );
            const shared = {
              'aria-labelledby': titleId,
              'aria-describedby': detailsId,
              'aria-current': isSelected ? ('true' as const) : undefined,
              'data-testid': 'card-grid-card',
              'data-state': isSelected ? 'selected' : undefined,
              className: cardClass,
            };
            return (
              <li
                key={key}
                className={cn(
                  'flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-foreground',
                  (isSelected || checked) &&
                    'border-primary ring-2 ring-primary/30',
                )}
              >
                {(onSelectedKeysChange || cardActions) && (
                  <div className="flex items-center justify-between gap-inline px-inline py-inline">
                    {onSelectedKeysChange && (
                      <Checkbox
                        aria-label={labels?.select?.(name) ?? `Select ${name}`}
                        checked={checked}
                        onCheckedChange={(value) => toggle(key, value === true)}
                      />
                    )}
                    {cardActions && (
                      <div className="ml-auto flex min-w-0 items-center gap-inline">
                        {cardActions}
                      </div>
                    )}
                  </div>
                )}
                {link !== undefined ? (
                  <a
                    {...shared}
                    href={link}
                    onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                      if (
                        !onOpen ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey ||
                        event.button !== 0
                      )
                        return;
                      event.preventDefault();
                      onOpen(row);
                    }}
                  >
                    {content}
                  </a>
                ) : onOpen ? (
                  <Button
                    {...shared}
                    variant="plain"
                    size={null}
                    shape={null}
                    type="button"
                    onClick={() => onOpen(row)}
                  >
                    {content}
                  </Button>
                ) : (
                  <article {...shared}>{content}</article>
                )}
                {cardPreview && (
                  <div className="min-w-0 border-t p-inline">{cardPreview}</div>
                )}
              </li>
            );
          })}
    </ul>
  );
}
