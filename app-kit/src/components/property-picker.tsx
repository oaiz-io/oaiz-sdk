import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Command } from 'cmdk';
import { Check } from 'lucide-react';

import { useIsMobile } from '../hooks/use-breakpoint';
import { cn } from '../lib/utils';
import { ErrorState } from './error-state';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';

export type PropertyOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  /** More words that find the option, such as an email address. */
  keywords?: string[];
};

export type PropertyPickerLabels = {
  none: string;
  search: (label: string) => string;
  choose: (label: string) => string;
  empty: string;
  unavailable: string;
  loading: string;
  retry: string;
  retrying: string;
  clear: string;
  loadMore: string;
  summary: (labels: string[]) => string;
};

export type PropertyPickerProps = {
  /** The property's name, such as "Status": the trigger's accessible name and the search placeholder. */
  label: string;
  value: string | null;
  options: PropertyOption[];
  onChange: (value: string) => void;
  /** Shown in the trigger while no option is chosen; the label when omitted. */
  placeholder?: ReactNode;
  /** Shown in the trigger while no option is chosen. */
  icon?: ReactNode;
  /**
   * `chip`: a bordered pill, as in a create form. `row`: a full-width line, as in a properties
   * panel. `icon`: only the option's icon, as in a dense list row.
   */
  variant?: 'chip' | 'row' | 'icon';
  /**
   * Reports the search text, so the caller can read matching options from OAIZ when the options
   * are too many to load at once.
   */
  onSearchChange?: (search: string) => void;
  /** Remote results are already filtered/ranked by the caller. */
  searchMode?: 'local' | 'remote';
  /** Selected labels independent of the current result page. */
  selectedOptions?: PropertyOption[];
  loading?: boolean;
  error?: { message: string } | null;
  onRetry?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onClear?: () => void;
  labels?: Partial<PropertyPickerLabels>;
  /** Control the menu, for example to open it with a hotkey. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  className?: string;
};

// On a phone the chip and the icon keep their size and take a 44px touch area around them.
const triggerStyles = {
  chip: 'relative inline-flex h-7 max-w-56 items-center gap-1.5 rounded-full border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted max-mobile:after:absolute max-mobile:after:-inset-y-2 max-mobile:after:inset-x-0',
  row: 'flex h-8 w-full items-center gap-inline rounded-md px-inline text-left text-sm text-foreground hover:bg-muted max-mobile:h-11',
  icon: 'relative inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted max-mobile:after:absolute max-mobile:after:-inset-2',
};

/**
 * One property of a record, such as status, priority or owner, set from a searchable menu.
 * Type to filter; Arrow keys move; Enter picks. Remote search and selected labels remain caller-owned.
 */
export function PropertyPicker({
  label,
  value,
  options,
  onChange,
  onSearchChange,
  searchMode = 'local',
  selectedOptions = [],
  loading = false,
  error,
  onRetry,
  hasMore,
  onLoadMore,
  onClear,
  labels,
  placeholder,
  icon,
  variant = 'chip',
  open: openProp,
  onOpenChange,
  disabled = false,
  className,
}: PropertyPickerProps) {
  const [openState, setOpenState] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const phone = useIsMobile();
  const open = openProp ?? openState;
  const changeSearch = (next: string) => {
    setSearch(next);
    onSearchChange?.(next);
  };
  const setOpen = (next: boolean) => {
    if (!next) changeSearch('');
    setOpenState(next);
    onOpenChange?.(next);
  };
  const current = [...selectedOptions, ...options].find(
    (option) => option.value === value,
  );
  const shownLabel = current?.label ?? value;

  function pick(option: PropertyOption) {
    setOpen(false);
    if (option.value !== value) onChange(option.value);
  }

  const shownIcon = current?.icon ?? icon;
  const trigger = (
    <Button variant="plain" size={null}
      type="button"
      disabled={disabled}
      aria-label={`${label}: ${shownLabel ?? labels?.none ?? 'none'}`}
      title={shownLabel ?? undefined}
      className={cn(triggerStyles[variant], TRIGGER_STATES, className)}
    >
      {shownIcon && (
        <span aria-hidden="true" className="flex shrink-0 items-center">
          {shownIcon}
        </span>
      )}
      {variant !== 'icon' && (
        <span className={cn('truncate', !current && 'text-muted-foreground')}>
          {shownLabel ?? placeholder ?? label}
        </span>
      )}
    </Button>
  );
  const menu = (
    <Command
      label={label}
      shouldFilter={searchMode !== 'remote'}
      className="flex min-h-0 flex-col"
    >
      <Command.Input
        ref={inputRef}
        value={search}
        onValueChange={changeSearch}
        aria-label={labels?.search?.(label) ?? `Change ${label.toLowerCase()}…`}
        placeholder={
          labels?.search?.(label) ?? `Change ${label.toLowerCase()}…`
        }
        // 16px text on a phone keeps iOS from zooming into the field.
        className={SEARCH_CLASS}
      />
      <Command.List className={LIST_CLASS} aria-busy={loading}>
        <Command.Empty className="px-inline py-2 text-sm text-muted-foreground">
          <div role="option" aria-disabled="true" aria-selected="false">
            {loading
              ? (labels?.loading ?? 'Loading…')
              : error
                ? (labels?.unavailable ?? 'Results unavailable.')
                : (labels?.empty ?? 'No match.')}
          </div>
        </Command.Empty>
        {options.map((option) => (
          <Command.Item
            key={option.value}
            value={`${option.label} ${option.value}`}
            keywords={option.keywords}
            onSelect={() => pick(option)}
            aria-current={option.value === value ? 'true' : undefined}
            className={ITEM_CLASS}
          >
            {option.icon && (
              <span
                aria-hidden="true"
                className="flex w-4 shrink-0 justify-center text-muted-foreground"
              >
                {option.icon}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {option.value === value && (
              <Check aria-hidden="true" className="text-foreground" />
            )}
          </Command.Item>
        ))}
      </Command.List>
      <PickerFeedback
        loading={loading}
        error={error}
        onRetry={onRetry}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        onClear={value !== null ? onClear : undefined}
        labels={labels}
      />
    </Command>
  );

  return (
    <PickerSurface
      label={label}
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      inputRef={inputRef}
      phone={phone}
      description={
        labels?.choose?.(label) ?? `Choose the ${label.toLowerCase()}.`
      }
    >
      {menu}
    </PickerSurface>
  );
}

/**
 * Where a picker's menu opens: a popover beside the trigger whose search takes focus, or on a
 * phone a sheet from the bottom, within reach of the thumb, whose search waits for a tap so the
 * keyboard does not cover the options.
 */
function PickerSurface({
  label,
  open,
  onOpenChange,
  trigger,
  inputRef,
  phone,
  description,
  children,
}: {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  inputRef: RefObject<HTMLInputElement | null>;
  phone: boolean;
  description: string;
  children: ReactNode;
}) {
  if (phone) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
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
            <SheetTitle>{label}</SheetTitle>
            <SheetDescription className="sr-only">
              {description}
            </SheetDescription>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        aria-label={label}
        align="start"
        className="w-60 p-0"
        // The search takes focus, also inside a dialog that traps it.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

const SEARCH_CLASS =
  'h-9 border-b bg-transparent px-inset text-base outline-none placeholder:text-muted-foreground max-mobile:h-11 mobile:text-sm';
const LIST_CLASS = 'max-h-64 overflow-y-auto p-1 max-mobile:max-h-none';
const ITEM_CLASS =
  'flex h-8 cursor-pointer items-center gap-inline rounded-sm px-inline text-sm text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground max-mobile:h-11 [&_svg]:size-3.5';
const TRIGGER_STATES =
  'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0';

export type MultiPropertyPickerProps = Omit<
  PropertyPickerProps,
  'value' | 'onChange' | 'variant'
> & {
  values: string[];
  onChange: (values: string[]) => void;
  /** `chip`: a pill that names the chosen options. `row`: a full-width line. */
  variant?: 'chip' | 'row';
};

/**
 * Several values of one property, such as labels or assignees, set from a searchable menu that
 * stays open while options are ticked. Each change reports the whole new list.
 */
export function MultiPropertyPicker({
  label,
  values,
  options,
  onChange,
  onSearchChange,
  searchMode = 'local',
  selectedOptions = [],
  loading = false,
  error,
  onRetry,
  hasMore,
  onLoadMore,
  onClear,
  labels,
  placeholder,
  icon,
  variant = 'chip',
  open: openProp,
  onOpenChange,
  disabled = false,
  className,
}: MultiPropertyPickerProps) {
  const [openState, setOpenState] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const phone = useIsMobile();
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (!next) {
      setSearch('');
      onSearchChange?.('');
    }
    setOpenState(next);
    onOpenChange?.(next);
  };
  const byValue = new Map(
    [...options, ...selectedOptions].map((option) => [option.value, option]),
  );
  const chosen = values.map(
    (value) => byValue.get(value) ?? { value, label: value },
  );
  const summary =
    chosen.length === 0
      ? undefined
      : chosen.length <= 2
        ? chosen.map((option) => option.label).join(', ')
        : (labels?.summary?.(chosen.map((option) => option.label)) ??
          `${chosen[0]!.label} and ${chosen.length - 1} more`);

  function toggle(option: PropertyOption) {
    onChange(
      values.includes(option.value)
        ? values.filter((value) => value !== option.value)
        : [...values, option.value],
    );
  }

  const trigger = (
    <Button variant="plain" size={null}
      type="button"
      disabled={disabled}
      aria-label={`${label}: ${summary ?? labels?.none ?? 'none'}`}
      title={chosen.map((option) => option.label).join(', ')}
      className={cn(triggerStyles[variant], TRIGGER_STATES, className)}
    >
      {icon && (
        <span aria-hidden="true" className="flex shrink-0 items-center">
          {icon}
        </span>
      )}
      <span className={cn('truncate', !summary && 'text-muted-foreground')}>
        {summary ?? placeholder ?? label}
      </span>
    </Button>
  );
  return (
    <PickerSurface
      label={label}
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      inputRef={inputRef}
      phone={phone}
      description={
        labels?.choose?.(label) ?? `Choose the ${label.toLowerCase()}.`
      }
    >
      <Command
        label={label}
        shouldFilter={searchMode !== 'remote'}
        className="flex min-h-0 flex-col"
      >
        <Command.Input
          ref={inputRef}
          value={search}
          onValueChange={(next) => {
            setSearch(next);
            onSearchChange?.(next);
          }}
          aria-label={labels?.search?.(label) ?? `Find ${label.toLowerCase()}…`}
          placeholder={
            labels?.search?.(label) ?? `Find ${label.toLowerCase()}…`
          }
          className={SEARCH_CLASS}
        />
        <Command.List
          className={LIST_CLASS}
          aria-multiselectable="true"
          aria-busy={loading}
        >
          <Command.Empty className="px-inline py-2 text-sm text-muted-foreground">
            <div role="option" aria-disabled="true" aria-selected="false">
              {loading
                ? (labels?.loading ?? 'Loading…')
                : error
                  ? (labels?.unavailable ?? 'Results unavailable.')
                  : (labels?.empty ?? 'No match.')}
            </div>
          </Command.Empty>
          {options.map((option) => {
            const isChosen = values.includes(option.value);
            return (
              <Command.Item
                key={option.value}
                value={`${option.label} ${option.value}`}
                keywords={option.keywords}
                onSelect={() => toggle(option)}
                aria-checked={isChosen}
                className={ITEM_CLASS}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary',
                    isChosen && 'bg-primary text-primary-foreground',
                  )}
                >
                  {isChosen && <Check className="size-3" />}
                </span>
                {option.icon && (
                  <span
                    aria-hidden="true"
                    className="flex w-4 shrink-0 justify-center text-muted-foreground"
                  >
                    {option.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </Command.Item>
            );
          })}
        </Command.List>
        <PickerFeedback
          loading={loading}
          error={error}
          onRetry={onRetry}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          onClear={
            values.length ? (onClear ?? (() => onChange([]))) : undefined
          }
          labels={labels}
        />
      </Command>
    </PickerSurface>
  );
}

function PickerFeedback({
  loading,
  error,
  onRetry,
  hasMore,
  onLoadMore,
  onClear,
  labels,
}: Pick<
  PropertyPickerProps,
  | 'loading'
  | 'error'
  | 'onRetry'
  | 'hasMore'
  | 'onLoadMore'
  | 'onClear'
  | 'labels'
>) {
  return (
    <div className="flex flex-col gap-inline px-inline pb-inline">
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          {labels?.loading ?? 'Loading…'}
        </p>
      )}
      {error && (
        <ErrorState
          error={error}
          onRetry={onRetry}
          retrying={loading}
          labels={labels}
        />
      )}
      {hasMore && onLoadMore && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={onLoadMore}
        >
          {labels?.loadMore ?? 'Load more'}
        </Button>
      )}
      {onClear && (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          {labels?.clear ?? 'Clear selection'}
        </Button>
      )}
    </div>
  );
}
