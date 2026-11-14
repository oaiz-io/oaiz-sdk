import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { cn } from '../lib/utils';
import { ErrorState } from './error-state';
import {
  Pager,
  SortControl,
  type CollectionPage,
  type PagerLabels,
} from './collection-controls';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Label } from './ui/label';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from './ui/dropdown-menu';
import { Checkbox } from './ui/checkbox';
import { Skeleton } from './ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableFooter,
  TableRow,
} from './ui/table';

export type DataTableColumn<Row> = {
  key: string;
  header: ReactNode;
  /** Shown before the header, such as an icon for the column's type. */
  icon?: ReactNode;
  cell: (row: Row) => ReactNode;
  /** The column the query sorts by when this header is clicked; the header is not sortable without it. */
  sortKey?: string;
  /** `number`: right-aligned tabular digits. */
  align?: 'number';
  className?: string;
  /** Full text for a value that the cell truncates; exposed in a keyboard/touch disclosure. */
  fullText?: (row: Row) => string;
  /** Text label for a header rendered as an icon or other React content. */
  label?: string;
  /** Fill remaining space or keep short metadata/actions at their intrinsic width. */
  layout?: 'fill' | 'content';
  /** False keeps a column visible; the record title also stays visible. */
  hideable?: boolean;
};

export type DataTableSort = { column: string; ascending: boolean };

export type DataTablePage = CollectionPage;

export type RowKeyValue = string | number;

export type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[] | undefined;
  rowKey: (row: Row) => RowKeyValue;
  /** Shown in one full-width cell when there are no rows. */
  empty: ReactNode;
  /** Rows on the table stay while new ones load; with no rows, a skeleton appears after a short wait. */
  loading?: boolean;
  /** Shown instead of the table. */
  error?: { message: string } | null;
  caption?: ReactNode;
  /** The sort the rows are in; sortable headers show it and ask for the next one. */
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort) => void;
  /** The keys of the selected rows; a checkbox column appears when `onSelectedChange` is set. */
  selected?: ReadonlySet<RowKeyValue>;
  onSelectedChange?: (selected: Set<RowKeyValue>) => void;
  /** Opens a record from its explicit button or a click on non-interactive row content. */
  onRowClick?: (row: Row) => void;
  /** A real link for record navigation, including modified click and open in a new tab. */
  rowHref?: (row: Row) => string;
  rowLabel?: (row: Row) => string;
  /** Which column names the record in the stacked layout. */
  titleColumn?: string;
  onRetry?: () => void;
  labels?: Partial<PagerLabels> & {
    selectPage?: string;
    selectRow?: (name: string) => string;
    open?: (name: string) => string;
    fullValue?: (name: string) => string;
    retry?: string;
    retrying?: string;
    sort?: string;
    choose?: string;
    ascending?: string;
    descending?: string;
    columns?: string;
    scrollRegion?: string;
  };
  /** A footer with the range shown and previous and next buttons. */
  page?: DataTablePage;
  /**
   * `grid`: cell borders, a compact header and a first column that stays in view on a horizontal
   * scroll. `default`: rows with a line between them.
   */
  variant?: 'default' | 'grid';
  density?: 'default' | 'compact' | 'dense';
  pageGutter?: boolean;
  /** Pins headings in the scroll owner; grid tables need fillHeight for vertical scrolling. */
  stickyHeader?: boolean;
  stickyHeaderTop?: string;
  /** Fills a parent with a definite height; the table owns the scrolling pane. */
  fillHeight?: boolean;
  columnVisibility?: Readonly<Record<string, boolean>>;
  onColumnVisibilityChange?: (visibility: Record<string, boolean>) => void;
  /** A last row under the table, such as the number of rows. */
  footer?: ReactNode;
};

const LOADING_ROWS = 3;
const SKELETON_DELAY_MS = 300;

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

function SortIcon({
  direction,
}: {
  direction: 'ascending' | 'descending' | 'none';
}) {
  if (direction === 'ascending') return <ArrowUp className="size-3.5" />;
  if (direction === 'descending') return <ArrowDown className="size-3.5" />;
  return <ArrowUpDown className="size-3.5 opacity-50" />;
}

/**
 * A table of rows, with its loading, empty and error states. Sorting and paging only report what
 * the reader asked for: the caller reads that sort and page from OAIZ.
 */
export function DataTable<Row>({
  columns: allColumns,
  rows,
  rowKey,
  empty,
  loading = false,
  error,
  caption,
  sort,
  onSortChange,
  selected,
  onSelectedChange,
  onRowClick,
  rowHref,
  rowLabel,
  titleColumn,
  onRetry,
  labels,
  page,
  variant = 'default',
  density,
  pageGutter,
  stickyHeader = true,
  stickyHeaderTop = '0px',
  fillHeight = false,
  columnVisibility,
  onColumnVisibilityChange,
  footer,
}: DataTableProps<Row>) {
  const tableId = useId();
  const titleKey =
    allColumns.find((column) => column.key === titleColumn)?.key ??
    allColumns[0]?.key;
  const canHide = (column: DataTableColumn<Row>) =>
    column.key !== titleKey && column.hideable !== false;
  const columns = allColumns.filter(
    (column) => !canHide(column) || columnVisibility?.[column.key] !== false,
  );
  const columnName = (column: DataTableColumn<Row>) =>
    column.label ??
    (typeof column.header === 'string' && column.header
      ? column.header
      : column.key);
  const columnLayout = (column: DataTableColumn<Row>) =>
    column.layout === 'fill'
      ? 'mobile:w-full mobile:max-w-0'
      : column.layout === 'content'
        ? 'mobile:w-px mobile:whitespace-nowrap'
        : undefined;
  const titleIndex = Math.max(
    0,
    columns.findIndex((column) => column.key === titleColumn),
  );
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

  const selectable = onSelectedChange !== undefined;
  const chosen = selected ?? new Set<RowKeyValue>();
  const shownKeys = (rows ?? []).map(rowKey);
  const chosenShown = shownKeys.filter((key) => chosen.has(key)).length;
  const allChosen =
    shownKeys.length > 0 && chosenShown === shownKeys.length
      ? true
      : chosenShown > 0
        ? 'indeterminate'
        : false;
  const width = columns.length + (selectable ? 1 : 0);
  const grid = variant === 'grid';
  const rowDensity = density ?? (grid ? 'compact' : 'default');
  const cellHeight =
    rowDensity === 'dense'
      ? 'h-9 py-1'
      : rowDensity === 'compact'
        ? 'h-11 py-inline'
        : 'py-inset';
  // The first and last cells meet the page gutter: a default table sits inside it, a grid fills the
  // page edge to edge.
  const edgeCell =
    (pageGutter ?? grid)
      ? grid
        ? 'first:pl-page last:pr-page'
        : 'mobile:first:pl-page mobile:last:pr-page'
      : 'mobile:first:pl-0 mobile:last:pr-0';
  const gridCheckboxWidth = 'w-[calc(var(--spacing-page)+1.75rem)]';
  // Grid cells keep one line; a wide table scrolls sideways instead.
  const gridCell =
    grid && 'whitespace-nowrap border-r border-b last:border-r-0';
  // On a phone the default variant stacks each row: the first column as its title, then the other
  // columns as muted, aligned columns under it. A last column without a header, such as a row's menu,
  // sits at the end of the title's line, and any other such column on its own line. The grid variant
  // scrolls sideways instead.
  const stackedTable = !grid && 'max-mobile:block';
  const stackedHead = !grid && 'max-mobile:sr-only';
  const stackedBody = !grid && 'max-mobile:block';
  const stackedRow =
    !grid &&
    cn(
      'max-mobile:grid max-mobile:grid-cols-[var(--stacked-columns)] max-mobile:items-baseline max-mobile:gap-x-stack max-mobile:gap-y-0.5 max-mobile:py-inline',
      pageGutter && 'max-mobile:px-page',
    );
  const stackedCell =
    !grid &&
    cn(
      'max-mobile:block max-mobile:h-auto max-mobile:min-w-0 max-mobile:break-words max-mobile:py-1',
      pageGutter && 'max-mobile:px-0',
    );
  const stackedFullWidth = !grid && 'max-mobile:col-span-full';
  const lastColumn = columns[columns.length - 1];
  const stackedControls =
    !grid &&
    !selectable &&
    columns.length > 1 &&
    columns.length - 1 !== titleIndex &&
    (typeof lastColumn?.header !== 'string' || !lastColumn.header)
      ? columns.length - 1
      : -1;
  // A row's first figure sits beside its name, so the details below it stay in line. Controls take
  // that place when the row has them.
  const stackedFigure =
    grid || selectable || stackedControls > 0
      ? -1
      : columns.findIndex(
          (column, index) => index !== titleIndex && column.align === 'number',
        );
  const stackedDetails = Math.min(
    2,
    Math.max(
      1,
      columns.filter(
        (column, index) =>
          index !== titleIndex &&
          index !== stackedFigure &&
          typeof column.header === 'string' &&
          column.header,
      ).length,
    ),
  );
  const stackedColumns = {
    '--stacked-columns': [
      'minmax(0,1.6fr)',
      ...Array<string>(stackedDetails - 1).fill('minmax(0,1fr)'),
    ].join(' '),
  } as CSSProperties;
  const stackedDetail =
    'max-mobile:text-xs max-mobile:text-muted-foreground max-mobile:[&>span]:text-xs';
  const stackedTitleWithFigure = 'max-mobile:row-start-1 max-mobile:pr-24';
  const stackedFigureCell =
    'max-mobile:col-span-full max-mobile:row-start-1 max-mobile:justify-self-end max-mobile:text-sm';
  const stackedControlsCell =
    'max-mobile:col-span-full max-mobile:row-start-1 max-mobile:justify-self-end max-mobile:self-start max-mobile:overflow-visible';
  // The checkbox column and the first column stay in view on a horizontal scroll.
  const stickyCell =
    'sticky z-10 bg-background group-hover/row:bg-[color-mix(in_srgb,var(--color-muted)_50%,var(--color-background))] group-data-[state=selected]/row:bg-muted';
  const sticky = (index: number) =>
    grid &&
    index === 0 &&
    cn(
      stickyCell,
      selectable ? 'left-[calc(var(--spacing-page)+1.75rem)]' : 'left-0',
    );
  const stickyCheckbox = grid && cn(stickyCell, 'left-0');

  const toggle = (key: RowKeyValue, on: boolean) => {
    const next = new Set(chosen);
    if (on) next.add(key);
    else next.delete(key);
    onSelectedChange?.(next);
  };
  const toggleAll = (on: boolean) => {
    const next = new Set(chosen);
    for (const key of shownKeys) {
      if (on) next.add(key);
      else next.delete(key);
    }
    onSelectedChange?.(next);
  };

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-inline',
        fillHeight && 'h-full min-h-0',
      )}
      style={stackedColumns}
    >
      {onColumnVisibilityChange && (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                {labels?.columns ?? 'Columns'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              aria-label={labels?.columns ?? 'Columns'}
            >
              {allColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={
                    !canHide(column) || columnVisibility?.[column.key] !== false
                  }
                  disabled={!canHide(column)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) =>
                    onColumnVisibilityChange({
                      ...columnVisibility,
                      [column.key]: checked === true,
                    })
                  }
                >
                  {columnName(column)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {!grid && !noRows && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-stack mobile:hidden',
            pageGutter && 'px-page py-inline',
          )}
        >
          {selectable && (
            <Label className="flex items-center gap-inline">
              <Checkbox
                aria-label={
                  labels?.selectPage ?? 'Select all rows on this page'
                }
                checked={allChosen}
                onCheckedChange={(state) => toggleAll(state === true)}
              />
              {labels?.selectPage ?? 'Select all rows on this page'}
            </Label>
          )}
          {onSortChange && columns.some((column) => column.sortKey) && (
            <SortControl
              options={columns
                .filter((column) => column.sortKey)
                .map((column) => ({
                  value: column.sortKey!,
                  label:
                    column.label ??
                    (typeof column.header === 'string'
                      ? column.header
                      : column.key),
                }))}
              value={sort}
              onChange={onSortChange}
              labels={labels}
            />
          )}
        </div>
      )}
      <div
        role={fillHeight ? 'region' : 'group'}
        aria-label={
          labels?.scrollRegion ??
          (typeof caption === 'string' ? caption : 'Table records')
        }
        tabIndex={0}
        className={cn(
          'min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          fillHeight || grid ? 'overflow-auto' : 'overflow-visible',
          fillHeight && 'min-h-0 flex-1',
        )}
      >
        <Table
          containerClassName="overflow-visible"
          aria-busy={loading}
          data-testid="data-table"
          data-variant={variant}
          data-density={rowDensity}
          className={cn(
            grid && 'border-separate border-spacing-0',
            stackedTable,
          )}
        >
          {caption !== undefined && (
            <TableCaption className="sr-only">{caption}</TableCaption>
          )}
          <TableHeader
            className={cn(
              stackedHead,
              stickyHeader &&
                (grid
                  ? 'sticky z-30 bg-background'
                  : 'mobile:sticky mobile:z-30 mobile:bg-background'),
              noRows && !waiting && 'hidden',
            )}
            style={stickyHeader ? { top: stickyHeaderTop } : undefined}
          >
            <TableRow className={cn(grid && 'hover:bg-transparent')}>
              {selectable && (
                <TableHead
                  id={`${tableId}-selection`}
                  scope="col"
                  className={cn(
                    'h-auto px-inset py-inline',
                    edgeCell,
                    grid
                      ? cn('z-20 border-b border-r', gridCheckboxWidth)
                      : 'w-10',
                    stickyCheckbox,
                  )}
                >
                  {!grid && (
                    <span className="mobile:hidden">
                      {labels?.selectPage ?? 'Select all rows on this page'}
                    </span>
                  )}
                  <Checkbox
                    aria-label={
                      labels?.selectPage ?? 'Select all rows on this page'
                    }
                    className={!grid ? 'max-mobile:hidden' : undefined}
                    checked={allChosen}
                    disabled={shownKeys.length === 0}
                    onCheckedChange={(state) => toggleAll(state === true)}
                  />
                </TableHead>
              )}
              {columns.map((column, index) => {
                const direction =
                  sort && column.sortKey === sort.column
                    ? sort.ascending
                      ? 'ascending'
                      : 'descending'
                    : 'none';
                return (
                  <TableHead
                    key={column.key}
                    id={`${tableId}-${column.key}`}
                    scope="col"
                    aria-label={column.label}
                    aria-sort={column.sortKey ? direction : undefined}
                    className={cn(
                      'h-auto px-inset py-inline text-xs font-medium',
                      edgeCell,
                      grid &&
                        'whitespace-nowrap border-b border-r last:border-r-0',
                      column.align === 'number' && 'text-right',
                      sticky(index),
                      grid && index === 0 && 'z-20',
                      columnLayout(column),
                      column.className,
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {!column.header && (
                        <span className="sr-only">
                          {column.label ?? column.key}
                        </span>
                      )}
                      {!grid && column.sortKey && onSortChange && (
                        <span className="mobile:hidden">{column.header}</span>
                      )}
                      {column.icon && (
                        <span
                          aria-hidden="true"
                          className="flex text-muted-foreground [&_svg]:size-3.5"
                        >
                          {column.icon}
                        </span>
                      )}
                      {column.sortKey && onSortChange ? (
                        <Button
                          variant="plain"
                          size="xs"
                          type="button"
                          aria-label={column.label}
                          className={cn(
                            !grid && 'max-mobile:hidden',
                            '-mx-1 h-auto min-h-6 gap-1 px-1 hover:text-foreground',
                          )}
                          onClick={() =>
                            onSortChange({
                              column: column.sortKey!,
                              ascending: direction !== 'ascending',
                            })
                          }
                        >
                          {column.header}
                          <SortIcon direction={direction} />
                        </Button>
                      ) : (
                        column.header
                      )}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody className={cn(stackedBody)}>
            {waiting ? (
              showSkeleton &&
              Array.from({ length: LOADING_ROWS }, (_, index) => (
                <TableRow key={index} className={cn(stackedRow)}>
                  {Array.from({ length: width }, (_, cell) => (
                    <TableCell
                      key={cell}
                      className={cn(
                        cellHeight,
                        'px-inset',
                        edgeCell,
                        gridCell,
                        stackedCell,
                      )}
                    >
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : noRows ? (
              <TableRow className={cn(stackedRow)}>
                <TableCell
                  colSpan={width}
                  className={cn(
                    cellHeight,
                    stackedCell,
                    stackedFullWidth,
                    'px-inset text-center text-muted-foreground',
                    grid && 'border-b',
                  )}
                >
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows!.map((row) => {
                const key = rowKey(row);
                const isChosen = chosen.has(key);
                return (
                  <TableRow
                    key={key}
                    data-testid="data-table-row"
                    data-state={isChosen ? 'selected' : undefined}
                    className={cn(
                      'group/row',
                      grid && 'border-0',
                      stackedRow,
                      onRowClick &&
                        'cursor-pointer focus-visible:bg-muted focus-visible:outline-none',
                    )}
                    onClick={
                      onRowClick
                        ? (event) => {
                            if (
                              !event.currentTarget.contains(
                                event.target as Node,
                              )
                            )
                              return;
                            if (
                              (event.target as Element).closest(
                                'button, a, input, select, textarea, [role="checkbox"], [contenteditable="true"]',
                              )
                            )
                              return;
                            onRowClick(row);
                          }
                        : undefined
                    }
                  >
                    {selectable && (
                      <TableCell
                        headers={`${tableId}-selection`}
                        className={cn(
                          cellHeight,
                          'px-inset',
                          edgeCell,
                          grid ? gridCheckboxWidth : 'w-10',
                          gridCell,
                          stickyCheckbox,
                          stackedCell,
                          stackedFullWidth,
                        )}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Checkbox
                          className={!grid ? 'max-mobile:size-6' : undefined}
                          aria-label={
                            labels?.selectRow?.(
                              rowLabel?.(row) ?? String(key),
                            ) ?? `Select ${rowLabel?.(row) ?? String(key)}`
                          }
                          checked={isChosen}
                          onCheckedChange={(state) =>
                            toggle(key, state === true)
                          }
                        />
                      </TableCell>
                    )}
                    {columns.map((column, index) => (
                      <TableCell
                        key={column.key}
                        headers={`${tableId}-${column.key}`}
                        className={cn(
                          cellHeight,
                          'px-inset',
                          edgeCell,
                          gridCell,
                          column.align === 'number' &&
                            'text-right tabular-nums',
                          sticky(index),
                          stackedCell,
                          !grid &&
                            index === titleIndex &&
                            'max-mobile:font-medium max-mobile:col-span-full max-mobile:-order-1',
                          (index === titleIndex ||
                            !column.header ||
                            typeof column.header !== 'string') &&
                            stackedFullWidth,
                          !grid &&
                            index !== titleIndex &&
                            index !== stackedFigure &&
                            stackedDetail,
                          index === titleIndex &&
                            (stackedFigure >= 0 || stackedControls >= 0) &&
                            stackedTitleWithFigure,
                          index === stackedFigure && stackedFigureCell,
                          index === stackedControls && stackedControlsCell,
                          columnLayout(column),
                          column.className,
                          !grid &&
                            column.align !== 'number' &&
                            'max-mobile:text-left',
                        )}
                      >
                        {!grid && (column.label || column.header) && (
                          <span
                            aria-hidden="true"
                            className="block text-xs font-normal text-muted-foreground mobile:hidden"
                          >
                            {column.label ?? column.header}
                          </span>
                        )}
                        <div
                          className={
                            index === titleIndex && (rowHref || onRowClick)
                              ? 'flex min-w-0 items-center gap-2'
                              : 'contents'
                          }
                        >
                          <div
                            className={
                              index === titleIndex && (rowHref || onRowClick)
                                ? 'min-w-0 flex-1'
                                : 'contents'
                            }
                          >
                            {column.cell(row)}
                          </div>
                          {rowHref && index === titleIndex && (
                            <a
                              href={rowHref(row)}
                              aria-label={
                                labels?.open?.(
                                  rowLabel?.(row) ?? String(key),
                                ) ?? `Open ${rowLabel?.(row) ?? String(key)}`
                              }
                              className="inline-flex shrink-0 min-h-6 min-w-6 items-center justify-center rounded-sm underline focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              ↗
                            </a>
                          )}
                          {index === titleIndex && onRowClick && !rowHref && (
                            <Button
                              variant="plain"
                              size="icon-xs"
                              type="button"
                              className="shrink-0 min-h-6 min-w-6 rounded-sm px-1 text-xs underline focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => onRowClick(row)}
                              aria-label={
                                labels?.open?.(
                                  rowLabel?.(row) ?? String(key),
                                ) ?? `Open ${rowLabel?.(row) ?? String(key)}`
                              }
                            >
                              ↗
                            </Button>
                          )}
                        </div>
                        {column.fullText && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="plain"
                                size="icon-xs"
                                type="button"
                                className="ml-1 min-h-6 min-w-6 rounded-sm text-xs underline"
                                aria-label={
                                  labels?.fullValue?.(
                                    column.label ??
                                      (typeof column.header === 'string'
                                        ? column.header
                                        : column.key),
                                  ) ??
                                  `Show full ${column.label ?? (typeof column.header === 'string' ? column.header : column.key)}`
                                }
                              >
                                …
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              aria-label={
                                labels?.fullValue?.(
                                  column.label ??
                                    (typeof column.header === 'string'
                                      ? column.header
                                      : column.key),
                                ) ??
                                `Full ${column.label ?? (typeof column.header === 'string' ? column.header : column.key)}`
                              }
                              className="max-w-[90vw] break-words"
                            >
                              {column.fullText(row)}
                            </PopoverContent>
                          </Popover>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
          {footer !== undefined && (
            <TableFooter>
              <TableRow>
                <TableCell
                  colSpan={width}
                  className={cn(
                    'px-inset py-inline text-xs text-muted-foreground',
                    !grid && 'border-t',
                  )}
                >
                  {footer}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      {page && <Pager page={page} loading={loading} labels={labels} />}
    </div>
  );
}
