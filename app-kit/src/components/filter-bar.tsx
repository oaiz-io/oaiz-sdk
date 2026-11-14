import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Command } from 'cmdk';
import { Check, ChevronRight, ListFilter, Search, X } from 'lucide-react';

import { useIsMobile } from '../hooks/use-breakpoint';
import { useHotkey } from './command-palette';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { Text } from './ui/text';

export type FilterOption = { value: string; label: ReactNode };

export type FilterField = {
  key: string;
  label: string;
  options: FilterOption[];
};

export type FilterValues = {
  search: string;
  /** The chosen option of each field; a missing key means any value. */
  filters: Record<string, string | undefined>;
};

export const emptyFilters: FilterValues = { search: '', filters: {} };

export type FilterBarProps = {
  fields: FilterField[];
  value: FilterValues;
  onChange: (value: FilterValues) => void;
  /** Without it the bar has no search box. */
  searchPlaceholder?: string;
  /** For example "24 orders". */
  summary?: ReactNode;
  /** Buttons at the end of the bar. */
  actions?: ReactNode;
  /** Additional filter controls, such as date ranges or multiselects. */
  children?: ReactNode;
  /** Less-used filter controls shown in a named popover. */
  moreFilters?: ReactNode;
  moreFiltersCount?: number;
  /** F opens the menu only while focus is inside this filter bar. */
  shortcuts?: boolean;
  labels?: Partial<{
    filter: string;
    search: string;
    filterBy: (field: string) => string;
    noMatch: string;
    is: string;
    remove: (field: string) => string;
    description: string;
    clear: string;
    moreFilters: string;
  }>;
};

const ITEM =
  'flex h-8 max-mobile:h-11 cursor-pointer items-center gap-inline rounded-sm px-inline text-sm text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground';
const SEARCH_DELAY_MS = 250;

/** One condition of `toRowFilters`; `useRows` and `usePagedRows` accept it as a `RowFilter`. */
export type FilterCondition =
  | { column: string; op: 'eq'; value: string }
  | { column: string; op: 'ilike'; value: string }
  | { op: 'or'; value: string };

/**
 * The conditions a query sends for `value`: `eq` per chosen field and, when there is search text,
 * `ilike` on `searchColumn`, or on any of several. `columns` maps a field key to its column when they differ.
 */
export function toRowFilters(
  value: FilterValues,
  options: {
    searchColumn?: string | string[];
    columns?: Record<string, string>;
  } = {},
): FilterCondition[] {
  const conditions: FilterCondition[] = [];
  for (const [key, chosen] of Object.entries(value.filters)) {
    if (chosen !== undefined) {
      conditions.push({
        column: options.columns?.[key] ?? key,
        op: 'eq',
        value: chosen,
      });
    }
  }
  const search = value.search.trim();
  const searched = [options.searchColumn ?? []].flat();
  if (search !== '' && searched.length > 0) {
    const pattern = `%${search.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    if (searched.length === 1) {
      conditions.push({ column: searched[0]!, op: 'ilike', value: pattern });
    } else {
      const quoted = `"${pattern.replace(/[\\"]/g, (match) => `\\${match}`)}"`;
      conditions.push({
        op: 'or',
        value: searched.map((column) => `${column}.ilike.${quoted}`).join(','),
      });
    }
  }
  return conditions;
}

/**
 * A search box, one Filter menu and a chip for each active filter. The
 * menu lists the fields, then the chosen field's values; F opens it. A chip's x removes that
 * filter. Search text reaches `onChange` after a short pause in typing, so each keystroke does
 * not start a query.
 */
export function FilterBar({
  fields,
  value,
  onChange,
  searchPlaceholder,
  summary,
  actions,
  children,
  moreFilters,
  moreFiltersCount = 0,
  shortcuts = true,
  labels,
}: FilterBarProps) {
  const [search, setSearch] = useState(value.search);
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<FilterField | null>(null);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  const phone = useIsMobile();

  useEffect(() => {
    setSearch(value.search);
  }, [value.search]);

  useEffect(() => {
    if (search === value.search) return;
    const timer = setTimeout(
      () => onChange({ ...value, search }),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [search, value, onChange]);

  useHotkey(
    'f',
    () => {
      if (fields.length > 0) openMenu(null);
    },
    { scope: scopeRef, enabled: shortcuts },
  );

  function openMenu(start: FilterField | null) {
    setField(start);
    setQuery('');
    setOpen(true);
  }

  function choose(key: string, chosen: string | undefined) {
    onChange({ ...value, filters: { ...value.filters, [key]: chosen } });
    setOpen(false);
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setField(null);
  }

  const trigger = (
    <Button
      variant="ghost"
      size="xs"
      className="text-muted-foreground"
      onClick={() => openMenu(null)}
    >
      <ListFilter />
      {labels?.filter ?? 'Filter'}
    </Button>
  );
  const menu = (
    <Command
      label={
        field
          ? (labels?.filterBy?.(field.label) ?? `${field.label} filter`)
          : (labels?.filter ?? 'Filter')
      }
      className="flex flex-col"
      onKeyDown={(event) => {
        if (event.key === 'Backspace' && query === '' && field) {
          event.preventDefault();
          setField(null);
        }
      }}
    >
      <div className="flex items-center gap-1.5 border-b px-inset">
        {field && (
          <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {field.label}
          </span>
        )}
        <Command.Input
          ref={inputRef}
          value={query}
          onValueChange={setQuery}
          aria-label={
            field
              ? (labels?.filterBy?.(field.label) ??
                `Filter by ${field.label.toLowerCase()}…`)
              : (labels?.search ?? 'Filter…')
          }
          placeholder={
            field
              ? (labels?.filterBy?.(field.label) ??
                `Filter by ${field.label.toLowerCase()}…`)
              : (labels?.search ?? 'Filter…')
          }
          className="h-9 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground max-mobile:h-11 mobile:text-sm"
        />
      </div>
      <Command.List className="max-h-64 overflow-y-auto p-1 max-mobile:max-h-none">
        <Command.Empty className="px-inline py-2 text-sm text-muted-foreground">
          <div role="option" aria-disabled="true" aria-selected="false">
            {labels?.noMatch ?? 'No match.'}
          </div>
        </Command.Empty>
        {field
          ? field.options.map((option) => (
              <Command.Item
                key={option.value}
                value={`${option.value} ${typeof option.label === 'string' ? option.label : ''}`}
                onSelect={() => choose(field.key, option.value)}
                className={ITEM}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {value.filters[field.key] === option.value && (
                  <Check className="size-3.5" />
                )}
              </Command.Item>
            ))
          : fields.map((each) => (
              <Command.Item
                key={each.key}
                value={each.label}
                onSelect={() => {
                  setField(each);
                  if (!phone) inputRef.current?.focus();
                  setQuery('');
                }}
                className={ITEM}
              >
                <span className="min-w-0 flex-1 truncate">{each.label}</span>
                <ChevronRight className="size-3.5 text-muted-foreground" />
              </Command.Item>
            ))}
      </Command.List>
    </Command>
  );

  const active = fields.filter((each) => value.filters[each.key] !== undefined);
  const anyActive = value.search !== '' || active.length > 0;

  return (
    <div
      ref={scopeRef}
      role="search"
      className="flex flex-wrap items-center gap-inline"
    >
      {searchPlaceholder !== undefined && (
        <div className="relative w-full mobile:w-56">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            // 16px text on a phone keeps iOS from zooming into the field.
            className="h-8 pl-8 text-base mobile:text-sm"
          />
        </div>
      )}
      {active.map((each) => {
        const chosen = each.options.find(
          (option) => option.value === value.filters[each.key],
        );
        return (
          <span
            key={each.key}
            data-testid="filter-chip"
            className="inline-flex h-7 items-center overflow-hidden rounded-md border bg-background text-xs"
          >
            <span className="px-2 text-muted-foreground">{each.label}</span>
            <span className="border-l px-1.5 text-muted-foreground">
              {labels?.is ?? 'is'}
            </span>
            <Button
              variant="plain"
              size="xs"
              type="button"
              className="h-full border-l px-2 font-medium text-foreground hover:bg-muted"
              onClick={() => openMenu(each)}
            >
              {chosen?.label ?? value.filters[each.key]}
            </Button>
            <Button
              variant="plain"
              size="xs"
              type="button"
              aria-label={
                labels?.remove?.(each.label) ?? `Remove ${each.label} filter`
              }
              className="flex h-full items-center border-l px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => choose(each.key, undefined)}
            >
              <X className="size-3" />
            </Button>
          </span>
        );
      })}
      {fields.length > 0 &&
        (phone ? (
          // On a phone the menu is a sheet from the bottom, within reach of the thumb. Its search
          // waits for a tap, so the keyboard does not cover the options.
          <Sheet open={open} onOpenChange={changeOpen}>
            <SheetTrigger asChild>{trigger}</SheetTrigger>
            <SheetContent
              side="bottom"
              className="flex max-h-[80dvh] flex-col gap-0 rounded-t-lg p-0 pb-[env(safe-area-inset-bottom)]"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                (event.currentTarget as HTMLElement).focus();
              }}
            >
              <SheetHeader className="px-stack pt-stack pb-inline text-left">
                <SheetTitle>
                  {field ? field.label : (labels?.filter ?? 'Filter')}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  {labels?.description ?? 'Choose what the list shows.'}
                </SheetDescription>
              </SheetHeader>
              {menu}
            </SheetContent>
          </Sheet>
        ) : (
          <Popover open={open} onOpenChange={changeOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent
              aria-label={field?.label ?? labels?.filter ?? 'Filter'}
              align="start"
              className="w-60 p-0"
              // The search takes focus, also inside a dialog that traps it.
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                inputRef.current?.focus();
              }}
            >
              {menu}
            </PopoverContent>
          </Popover>
        ))}
      {children}
      {moreFilters !== undefined && (
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              {labels?.moreFilters ?? 'More filters'}
              {moreFiltersCount > 0 ? ` (${moreFiltersCount})` : ''}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            aria-label={labels?.moreFilters ?? 'More filters'}
            align="start"
            className="flex max-w-[calc(100vw-2rem)] flex-col gap-stack"
          >
            {moreFilters}
          </PopoverContent>
        </Popover>
      )}
      {anyActive && (
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          onClick={() => {
            setSearch('');
            onChange(emptyFilters);
          }}
        >
          {labels?.clear ?? 'Clear'}
        </Button>
      )}
      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-inline">
        {summary !== undefined && (
          <Text size="sm" variant="muted" aria-live="polite">
            {summary}
          </Text>
        )}
        {actions}
      </div>
    </div>
  );
}
