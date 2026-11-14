import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Plus } from 'lucide-react';
import { Temporal } from 'temporal-polyfill';

import { useBreakpointBelow } from '../hooks/use-breakpoint';
import {
  formatDate,
  formatDay,
  formatTime,
  formatWeekday,
  localDay,
  parseLocalDay,
} from '../lib/format';
import { cn } from '../lib/utils';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { TimeInput } from './date-input';
import { Button } from './ui/button';
import { Heading } from './ui/heading';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Skeleton } from './ui/skeleton';
import { Text } from './ui/text';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

/** A day of the member's own calendar as `YYYY-MM-DD`, as `localDay()` writes it. */
export type CalendarDay = string;

export type CalendarEvent = {
  id: string | number;
  title: string;
  /** When it starts: a `Date`, or an ISO timestamp such as a `timestamptz` column holds. */
  start: Date | string;
  /** When it ends. An all-day event ends at the midnight after its last day. */
  end: Date | string;
  allDay?: boolean;
  /** Its colour, one of the theme's five chart colours from 0; give each resource or person one. */
  color?: number;
  /** A second line, such as the room or the person. */
  detail?: string;
};

export type CalendarViewProps = {
  /** What the grid is of, such as "Bookings"; the grid's accessible name. */
  label: string;
  view: 'month' | 'week';
  locale?: string;
  /** IANA timezone used for event dates and times; defaults to the browser's timezone. */
  timeZone?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  messages?: Partial<CalendarMessages>;
  onRetry?: () => void;
  /** A day of the month or week on screen. */
  date: CalendarDay;
  events: CalendarEvent[];
  /**
   * A click on a day's free space, Enter on a focused day, or a click on an hour of the week view,
   * which also passes that hour as `HH:MM`.
   */
  onSelectDay?: (day: CalendarDay, time?: string) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
  /** The arrow keys left the month on screen: show the month of `day`. */
  onDateChange?: (day: CalendarDay) => void;
  /** The accessible name of a button that selects a day, such as "Book on Monday 9 November". */
  selectDayLabel?: (day: CalendarDay) => string;
  /** `auto` lists the days as an agenda on a phone and draws the grid on a wider screen. */
  layout?: 'auto' | 'grid' | 'agenda';
  onLayoutChange?: (layout: 'grid' | 'agenda') => void;
  showLayoutControl?: boolean;
  /** The most events a month day shows before "+N more". */
  maxPerDay?: number;
  loading?: boolean;
  error?: { message: string } | null;
  /** What the agenda shows when no event falls in the period. */
  empty?: ReactNode;
  /** The day marked as today; the member's today when omitted. */
  today?: CalendarDay;
  className?: string;
};

// ---------------------------------------------------------------------------------------------
// Date maths on local calendar days. Each step goes through `new Date(year, month, day)`, so a day
// is always a calendar day of the member's zone, also across a daylight saving change.

function dateOf(day: CalendarDay): Date {
  return parseLocalDay(day) ?? new Date(Number.NaN);
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** The day `amount` calendar days after `day`; negative goes back. */
export function addDays(day: CalendarDay, amount: number): CalendarDay {
  const date = dateOf(day);
  return localDay(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount),
  );
}

/** How many calendar days `to` is after `from`; negative when it is before. */
export function daysBetween(from: CalendarDay, to: CalendarDay): number {
  const a = dateOf(from);
  const b = dateOf(to);
  // Whole days in UTC, where no day is 23 or 25 hours long.
  return Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      86_400_000,
  );
}

/** The same day `amount` months later, held to the last day of a shorter month: 31 Jan + 1 is 28 Feb. */
export function addMonths(day: CalendarDay, amount: number): CalendarDay {
  const date = dateOf(day);
  const last = new Date(
    date.getFullYear(),
    date.getMonth() + amount + 1,
    0,
  ).getDate();
  return localDay(
    new Date(
      date.getFullYear(),
      date.getMonth() + amount,
      Math.min(date.getDate(), last),
    ),
  );
}

/** The first day of the week containing `day`; Monday by default. */
export function startOfWeek(day: CalendarDay, weekStartsOn = 1): CalendarDay {
  return addDays(day, -((dateOf(day).getDay() - weekStartsOn + 7) % 7));
}

/** The seven days of the configured week containing `day`. */
export function weekDays(day: CalendarDay, weekStartsOn = 1): CalendarDay[] {
  const monday = startOfWeek(day, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** Whole weeks surrounding the month, using the configured first weekday. */
export function monthWeeks(
  day: CalendarDay,
  weekStartsOn = 1,
): CalendarDay[][] {
  const first = `${day.slice(0, 7)}-01`;
  const weeks: CalendarDay[][] = [];
  let monday = startOfWeek(first, weekStartsOn);
  while (weeks.length === 0 || sameMonth(monday, first)) {
    weeks.push(weekDays(monday, weekStartsOn));
    monday = addDays(monday, 7);
  }
  return weeks;
}

export function sameMonth(a: CalendarDay, b: CalendarDay): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** The first day a view draws and the day after its last, for a query of the events it shows. */
export function visibleRange(
  view: 'month' | 'week',
  day: CalendarDay,
  weekStartsOn = 1,
): { from: CalendarDay; to: CalendarDay } {
  if (view === 'week') {
    const monday = startOfWeek(day, weekStartsOn);
    return { from: monday, to: addDays(monday, 7) };
  }
  const weeks = monthWeeks(day, weekStartsOn);
  return { from: weeks[0]![0]!, to: addDays(weeks[weeks.length - 1]![6]!, 1) };
}

function zoned(value: Date | string, timeZone: string) {
  return Temporal.Instant.fromEpochMilliseconds(
    toDate(value).getTime(),
  ).toZonedDateTimeISO(timeZone);
}

/** Days in the display timezone. A midnight end belongs to the preceding day. */
export function eventDays(
  event: Pick<CalendarEvent, 'start' | 'end'>,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): CalendarDay[] {
  if (
    !Number.isFinite(toDate(event.start).getTime()) ||
    !Number.isFinite(toDate(event.end).getTime())
  )
    return [];
  const start = zoned(event.start, timeZone);
  const end = zoned(event.end, timeZone);
  const first = start.toPlainDate().toString();
  const midnight =
    end.hour === 0 &&
    end.minute === 0 &&
    end.second === 0 &&
    end.millisecond === 0;
  const last =
    midnight && end.epochMilliseconds > start.epochMilliseconds
      ? end.toPlainDate().subtract({ days: 1 }).toString()
      : end.toPlainDate().toString();
  const days: CalendarDay[] = [];
  for (let day = first; day <= last && days.length < 366; day = addDays(day, 1))
    days.push(day);
  return days.length > 0 ? days : [first];
}

function byStart(a: CalendarEvent, b: CalendarEvent): number {
  if (Boolean(a.allDay) !== Boolean(b.allDay)) return a.allDay ? -1 : 1;
  const diff = toDate(a.start).getTime() - toDate(b.start).getTime();
  return diff !== 0 ? diff : a.title.localeCompare(b.title);
}

/** The events of each of `days`, all-day events first and then by start. */
export function eventsByDay(
  events: CalendarEvent[],
  days: CalendarDay[],
  timeZone?: string,
): Map<CalendarDay, CalendarEvent[]> {
  const shown = new Set(days);
  const map = new Map<CalendarDay, CalendarEvent[]>(
    days.map((day) => [day, []]),
  );
  for (const event of events) {
    for (const day of eventDays(event, timeZone)) {
      if (shown.has(day)) map.get(day)!.push(event);
    }
  }
  for (const list of map.values()) list.sort(byStart);
  return map;
}

/** The events whose time overlaps `[start, end)`; one that ends as the other starts does not. */
export function findOverlaps<
  Event extends Pick<CalendarEvent, 'start' | 'end'>,
>(
  range: { start: Date | string; end: Date | string },
  events: Event[],
): Event[] {
  const start = toDate(range.start).getTime();
  const end = toDate(range.end).getTime();
  return events.filter(
    (event) =>
      toDate(event.start).getTime() < end &&
      start < toDate(event.end).getTime(),
  );
}

export type TimedPlacement = {
  event: CalendarEvent;
  /** Minutes after midnight on the member's clock where it starts and ends on this day. */
  top: number;
  bottom: number;
  /** Its column among the events it overlaps, from 0, and how many columns they share. */
  column: number;
  columns: number;
};

/** The shortest an event draws in the week view, in minutes, so a short one stays clickable. */
const MIN_MINUTES = 30;

/**
 * Places the timed events of `day` by the hour: an event that overlaps others sits beside them in
 * the first free column. Minutes come from the clock, so an hour lost or gained to daylight saving
 * leaves every later event at its written time.
 */
export function layoutDay(
  events: CalendarEvent[],
  day: CalendarDay,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): TimedPlacement[] {
  const placed = events
    .filter((event) => !event.allDay)
    .flatMap((event) => {
      if (!eventDays(event, timeZone).includes(day)) return [];
      const start = zoned(event.start, timeZone);
      const end = zoned(event.end, timeZone);
      const top =
        start.toPlainDate().toString() < day
          ? 0
          : start.hour * 60 + start.minute;
      const bottom =
        end.toPlainDate().toString() > day
          ? 24 * 60
          : end.hour * 60 + end.minute;
      const drawnTop = Math.min(top, 24 * 60 - MIN_MINUTES);
      return [
        {
          event,
          top: drawnTop,
          bottom: Math.min(24 * 60, Math.max(bottom, drawnTop + MIN_MINUTES)),
          column: 0,
          columns: 1,
        },
      ];
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  let cluster: TimedPlacement[] = [];
  let ends: number[] = [];
  let clusterEnd = -1;
  const close = () => {
    for (const each of cluster) each.columns = ends.length;
    cluster = [];
    ends = [];
  };
  for (const each of placed) {
    if (each.top >= clusterEnd) close();
    let column = ends.findIndex((end) => end <= each.top);
    if (column === -1) column = ends.push(0) - 1;
    ends[column] = each.bottom;
    each.column = column;
    cluster.push(each);
    clusterEnd = Math.max(clusterEnd, each.bottom);
  }
  close();
  return placed;
}

// ---------------------------------------------------------------------------------------------
// Colours

// Whole class names, so Tailwind generates them: the chart tokens reach the page only through
// the utilities that use them.
const COLORS = [
  { dot: 'bg-chart-1', tint: 'bg-chart-1/15', bar: 'border-chart-1' },
  { dot: 'bg-chart-2', tint: 'bg-chart-2/15', bar: 'border-chart-2' },
  { dot: 'bg-chart-3', tint: 'bg-chart-3/15', bar: 'border-chart-3' },
  { dot: 'bg-chart-4', tint: 'bg-chart-4/15', bar: 'border-chart-4' },
  { dot: 'bg-chart-5', tint: 'bg-chart-5/15', bar: 'border-chart-5' },
] as const;

function colorOf(index = 0) {
  return COLORS[((index % COLORS.length) + COLORS.length) % COLORS.length]!;
}

export type CalendarLegendItem = {
  key: string | number;
  label: ReactNode;
  color: number;
};

/**
 * What each event colour stands for, in one row that scrolls sideways on a phone. With `onToggle` each item is a button that shows or hides
 * its events; `hidden` holds the keys hidden.
 */
export function CalendarLegend({
  label,
  items,
  hidden,
  onToggle,
  className,
}: {
  label: string;
  items: CalendarLegendItem[];
  hidden?: ReadonlySet<string | number>;
  onToggle?: (key: string | number) => void;
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
      tabIndex={0}
      className={cn(
        'flex flex-wrap items-center gap-x-stack gap-y-1 outline-none focus-visible:ring-2 focus-visible:ring-ring max-mobile:flex-nowrap max-mobile:overflow-x-auto',
        className,
      )}
    >
      {items.map((item) => {
        const off = hidden?.has(item.key) ?? false;
        const content = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                'size-2.5 shrink-0 rounded-full',
                colorOf(item.color).dot,
                off && 'opacity-30',
              )}
            />
            <Text
              as="span"
              size="xs"
              variant={off ? 'muted' : 'default'}
              className={cn(off && 'line-through')}
            >
              {item.label}
            </Text>
          </>
        );
        return (
          <li key={item.key} className="shrink-0">
            {onToggle ? (
              <Button variant="plain" size={null}
                type="button"
                aria-pressed={!off}
                onClick={() => onToggle(item.key)}
                className="flex min-h-6 items-center gap-1.5 rounded-sm px-1 outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring max-mobile:min-h-11"
              >
                {content}
              </Button>
            ) : (
              <span className="flex items-center gap-1.5 px-1">{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------
// The view

export type CalendarMessages = {
  grid: string;
  agenda: string;
  layout: string;
  allDay: string;
  today: string;
  empty: string;
  emptyDay: string;
  to: string;
  time: string;
  book: string;
  retry: string;
  zone: (timeZone: string) => string;
  more: (count: number) => string;
  moreOn: (count: number, day: string) => string;
  selectDay: (day: string) => string;
};
const CALENDAR_MESSAGES: CalendarMessages = {
  grid: 'Grid',
  agenda: 'Agenda',
  layout: 'Calendar layout',
  allDay: 'All day',
  today: 'Today',
  empty: 'Nothing on these days',
  emptyDay: 'No events',
  to: 'to',
  time: 'Time',
  book: 'Select time',
  retry: 'Retry',
  zone: (zone) => `Time zone: ${zone}`,
  more: (count) => `+${count} more`,
  moreOn: (count, day) => `${count} more on ${day}`,
  selectDay: (day) => `Add on ${day}`,
};
const CalendarContext = createContext({
  locale: undefined as string | undefined,
  timeZone: 'UTC',
  weekStartsOn: 1,
  messages: CALENDAR_MESSAGES,
});
function useCalendar() {
  const context = useContext(CalendarContext);
  return {
    ...context,
    dayLabel: (day: string) => formatDay(day, { locale: context.locale }),
    dateLabel: (day: string) => formatDate(day, { locale: context.locale }),
    weekday: (day: string, style: 'short' | 'long' = 'short') =>
      formatWeekday(day, { locale: context.locale, style }),
    time: (value: Date | string) =>
      formatTime(value, { locale: context.locale, timeZone: context.timeZone }),
  };
}

/**
 * A month or week of events. The month is a grid of days in which the arrow keys move
 * between days, Page Up and Page Down between months, and Enter selects the day; a day with more
 * events than fit shows "+N more". The week lays timed events out by the hour, side by side where
 * they overlap, under a row of all-day events. On a phone the days are an agenda list. Times show
 * in the requested IANA timezone.
 */
export function CalendarView({
  label,
  view,
  date,
  events,
  onSelectDay,
  onSelectEvent,
  onDateChange,
  selectDayLabel,
  layout = 'auto',
  onLayoutChange,
  showLayoutControl = true,
  locale,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  weekStartsOn = 1,
  messages: overrides,
  onRetry,
  maxPerDay = 3,
  loading = false,
  error,
  empty,
  today,
  className,
}: CalendarViewProps) {
  const phone = useBreakpointBelow('mobile');
  const [chosen, setChosen] = useState<'grid' | 'agenda' | null>(null);
  const activeLayout = onLayoutChange ? layout : (chosen ?? layout);
  const agenda =
    activeLayout === 'agenda' || (activeLayout === 'auto' && phone);
  const messages = { ...CALENDAR_MESSAGES, ...overrides };
  const currentDay = today ?? Temporal.Now.plainDateISO(timeZone).toString();
  const shared = {
    label,
    date,
    events: loading ? [] : events,
    onSelectDay,
    onSelectEvent,
    selectDayLabel,
    loading,
    today: currentDay,
  };
  return (
    <CalendarContext.Provider
      value={{ locale, timeZone, weekStartsOn, messages }}
    >
      <div className={cn('flex min-h-0 flex-col gap-inline', className)}>
        {showLayoutControl && (
          <div
            role="group"
            aria-label={messages.layout}
            className="flex flex-wrap gap-inline"
          >
            {(['grid', 'agenda'] as const).map((choice) => (
              <Button
                key={choice}
                variant="outline"
                size="sm"
                aria-pressed={choice === (agenda ? 'agenda' : 'grid')}
                onClick={() => {
                  if (onLayoutChange) onLayoutChange(choice);
                  else setChosen(choice);
                }}
              >
                {messages[choice]}
              </Button>
            ))}
          </div>
        )}
        <Text size="xs" variant="muted">
          {messages.zone(timeZone)}
        </Text>
        {error && (
          <ErrorState
            error={error}
            onRetry={onRetry}
            labels={{ retry: messages.retry }}
          />
        )}
        {agenda ? (
          <Agenda {...shared} view={view} empty={empty} />
        ) : view === 'month' ? (
          <MonthGrid
            {...shared}
            maxPerDay={maxPerDay}
            onDateChange={onDateChange}
          />
        ) : (
          <WeekGrid {...shared} />
        )}
      </div>
    </CalendarContext.Provider>
  );
}

type SharedProps = Pick<
  CalendarViewProps,
  | 'label'
  | 'date'
  | 'events'
  | 'onSelectDay'
  | 'onSelectEvent'
  | 'selectDayLabel'
  | 'loading'
> & { today: CalendarDay };

function EventChip({
  event,
  tabbable,
  onSelectEvent,
}: {
  event: CalendarEvent;
  tabbable: boolean;
  onSelectEvent?: (event: CalendarEvent) => void;
}) {
  const { time } = useCalendar();
  const color = colorOf(event.color);
  return (
    <Button variant="plain" size={null}
      type="button"
      tabIndex={tabbable ? 0 : -1}
      onClick={() => onSelectEvent?.(event)}
      className={cn(
        'flex min-h-6 w-full min-w-0 items-center gap-1 rounded-sm px-1 text-left outline-none transition-colors duration-fast ease-move focus-visible:ring-2 focus-visible:ring-ring',
        event.allDay
          ? cn(color.tint, 'hover:brightness-95 dark:hover:brightness-125')
          : 'hover:bg-surface-hover',
      )}
    >
      {event.allDay ? (
        <span
          aria-hidden="true"
          className={cn('h-3 w-0.5 shrink-0 rounded-full', color.dot)}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn('size-2 shrink-0 rounded-full', color.dot)}
        />
      )}
      {!event.allDay && (
        // A narrow day gives its room to the title; the time stays in the button's name.
        <Text
          as="span"
          size="xs"
          variant="muted"
          className="sr-only shrink-0 tabular-nums @min-[9rem]:not-sr-only"
        >
          {time(event.start)}
        </Text>
      )}
      <Text as="span" size="xs" className="min-w-0 truncate">
        {event.title}
      </Text>
      {event.detail && <span className="sr-only">, {event.detail}</span>}
    </Button>
  );
}

function MonthGrid({
  label,
  date,
  events,
  onSelectDay,
  onSelectEvent,
  onDateChange,
  loading,
  today,
  maxPerDay,
}: SharedProps & {
  maxPerDay: number;
  onDateChange?: (day: CalendarDay) => void;
}) {
  const { weekStartsOn, timeZone, dayLabel, dateLabel, weekday } =
    useCalendar();
  const weeks = monthWeeks(date, weekStartsOn);
  const days = weeks.flat();
  const byDay = eventsByDay(events, days, timeZone);
  const [focused, setFocused] = useState<CalendarDay | null>(null);
  const active =
    focused !== null && days.includes(focused)
      ? focused
      : sameMonth(today, date)
        ? today
        : date;
  const cells = useRef(new Map<CalendarDay, HTMLDivElement>());
  // The day a key moved to; it takes focus once it is on screen, which may be after a new month renders.
  const moveTo = useRef<CalendarDay | null>(null);

  useEffect(() => {
    const target = moveTo.current;
    const cell = target === null ? undefined : cells.current.get(target);
    if (cell) {
      moveTo.current = null;
      cell.focus();
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  });

  function move(next: CalendarDay) {
    if (!days.includes(next)) {
      if (!onDateChange) return;
      onDateChange(next);
    }
    moveTo.current = next;
    setFocused(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>, day: CalendarDay) {
    if (
      event.target !== event.currentTarget ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const monday = startOfWeek(day, weekStartsOn);
    const next: Record<string, CalendarDay> = {
      ArrowLeft: addDays(day, -1),
      ArrowRight: addDays(day, 1),
      ArrowUp: addDays(day, -7),
      ArrowDown: addDays(day, 7),
      Home: monday,
      End: addDays(monday, 6),
      PageUp: addMonths(day, -1),
      PageDown: addMonths(day, 1),
    };
    if (event.key in next) {
      event.preventDefault();
      move(next[event.key]!);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectDay?.(day);
    }
  }

  function onClick(event: MouseEvent<HTMLDivElement>, day: CalendarDay) {
    // Clicks on an event or in a portalled "+N more" list reach here through React's tree.
    const target = event.target as HTMLElement;
    if (!event.currentTarget.contains(target) || target.closest('button'))
      return;
    setFocused(day);
    onSelectDay?.(day);
  }

  return (
    <div
      role="grid"
      aria-label={label}
      aria-busy={loading || undefined}
      className="grid min-h-0 flex-1 overflow-y-auto rounded-md border"
      style={{
        gridTemplateRows: `auto repeat(${weeks.length}, minmax(6.5rem, 1fr))`,
      }}
    >
      <div role="row" className="grid grid-cols-7 border-b bg-muted/40">
        {weeks[0]!.map((day) => (
          <div
            key={day}
            role="columnheader"
            aria-label={weekday(day, 'long')}
            className="px-inline py-1"
          >
            <Text as="span" size="xs" variant="muted" weight="medium">
              {weekday(day)}
            </Text>
          </div>
        ))}
      </div>
      {weeks.map((week, row) => (
        <div
          key={week[0]}
          role="row"
          className={cn(
            'grid min-h-0 grid-cols-7',
            row < weeks.length - 1 && 'border-b',
          )}
        >
          {week.map((day, column) => {
            const list = byDay.get(day) ?? [];
            const fits = list.length > maxPerDay ? maxPerDay - 1 : list.length;
            const outside = !sameMonth(day, date);
            const isToday = day === today;
            const isActive = day === active;
            return (
              <div
                key={day}
                role="gridcell"
                ref={(element) => {
                  if (element) cells.current.set(day, element);
                  else cells.current.delete(day);
                }}
                tabIndex={isActive ? 0 : -1}
                aria-current={isToday ? 'date' : undefined}
                onKeyDown={(event) => onKeyDown(event, day)}
                onClick={(event) => onClick(event, day)}
                className={cn(
                  '@container flex min-h-0 min-w-0 cursor-pointer flex-col gap-0.5 overflow-hidden p-1 outline-none transition-colors duration-fast ease-move hover:bg-surface-hover/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  column < 6 && 'border-r',
                  outside && 'bg-muted/40',
                )}
              >
                <span className="sr-only">{dateLabel(day)}</span>
                <Text
                  as="span"
                  size="xs"
                  weight={isToday ? 'semibold' : 'medium'}
                  variant={isToday ? 'inverse' : outside ? 'muted' : 'default'}
                  aria-hidden="true"
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full tabular-nums',
                    isToday && 'bg-primary',
                  )}
                >
                  {dateOf(day).getDate()}
                </Text>
                {loading && (row + column) % 3 === 0 && (
                  <Skeleton className="h-4 w-4/5" />
                )}
                {list.slice(0, fits).map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    tabbable={isActive}
                    onSelectEvent={onSelectEvent}
                  />
                ))}
                {list.length > fits && (
                  <MoreEvents
                    day={day}
                    events={list}
                    hiddenCount={list.length - fits}
                    tabbable={isActive}
                    onSelectEvent={onSelectEvent}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MoreEvents({
  day,
  events,
  hiddenCount,
  tabbable,
  onSelectEvent,
}: {
  day: CalendarDay;
  events: CalendarEvent[];
  hiddenCount: number;
  tabbable: boolean;
  onSelectEvent?: (event: CalendarEvent) => void;
}) {
  const { messages, dayLabel, dateLabel } = useCalendar();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="plain" size={null}
          type="button"
          tabIndex={tabbable ? 0 : -1}
          aria-label={messages.moreOn(hiddenCount, dateLabel(day))}
          className="flex min-h-6 items-center rounded-sm px-1 text-left outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Text as="span" size="xs" variant="muted" weight="medium">
            {messages.more(hiddenCount)}
          </Text>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={dayLabel(day)}
        align="start"
        className="@container flex w-64 flex-col gap-1 p-inline"
      >
        <Heading level={2} size="sm" className="px-1 pb-1">
          {dayLabel(day)}
        </Heading>
        {events.map((event) => (
          <EventChip
            key={event.id}
            event={event}
            tabbable
            onSelectEvent={(chosen) => {
              setOpen(false);
              onSelectEvent?.(chosen);
            }}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** The height of one hour in the week view, in rem. */
const HOUR_REM = 3;

function WeekGrid({
  label,
  date,
  events,
  onSelectDay,
  onSelectEvent,
  selectDayLabel,
  loading,
  today,
}: SharedProps) {
  const { weekStartsOn, timeZone, locale, messages, weekday, dayLabel, time } =
    useCalendar();
  const days = weekDays(date, weekStartsOn);
  const byDay = eventsByDay(events, days, timeZone);
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const first = days[0];
  const firstHour = Math.min(
    8,
    ...days.flatMap((day) =>
      layoutDay(byDay.get(day) ?? [], day, timeZone).map((each) =>
        Math.floor(each.top / 60),
      ),
    ),
  );

  const openAt = useRef(firstHour);
  openAt.current = firstHour;

  // The day opens at eight, or at the week's first event when that is earlier. It scrolls when the
  // week changes, not when its events refetch.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const rem = Number.parseFloat(getComputedStyle(element).fontSize) || 16;
    // Half a rem above the hour, so its label shows whole.
    element.scrollTop = Math.max(0, (openAt.current * HOUR_REM - 0.5) * rem);
  }, [first]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const hasAllDay = days.some((day) =>
    (byDay.get(day) ?? []).some((event) => event.allDay),
  );
  const columns =
    'grid min-w-[56rem] grid-cols-[4.5rem_repeat(7,minmax(0,1fr))]';

  function onColumnClick(event: MouseEvent<HTMLDivElement>, day: CalendarDay) {
    if (event.target !== event.currentTarget || !onSelectDay) return;
    const box = event.currentTarget.getBoundingClientRect();
    const hour = Math.min(
      23,
      Math.max(0, Math.floor(((event.clientY - box.top) / box.height) * 24)),
    );
    onSelectDay(day, `${String(hour).padStart(2, '0')}:00`);
  }

  return (
    <section
      aria-label={label}
      aria-busy={loading || undefined}
      className="flex min-h-0 flex-1 flex-col overflow-x-auto rounded-md border"
    >
      <div className={cn(columns, 'border-b bg-muted/40')}>
        <span />
        {days.map((day) => {
          const isToday = day === today;
          const content = (
            <>
              <Text as="span" size="xs" variant="muted" weight="medium">
                {weekday(day)}
              </Text>
              <Text
                as="span"
                size="sm"
                weight="semibold"
                variant={isToday ? 'inverse' : 'default'}
                className={cn(
                  'flex size-7 items-center justify-center rounded-full tabular-nums',
                  isToday && 'bg-primary',
                )}
              >
                {dateOf(day).getDate()}
              </Text>
            </>
          );
          return onSelectDay ? (
            <Button variant="plain" size={null}
              key={day}
              type="button"
              aria-label={
                selectDayLabel?.(day) ?? messages.selectDay(dayLabel(day))
              }
              aria-current={isToday ? 'date' : undefined}
              onClick={() => onSelectDay(day, '09:00')}
              className="flex min-h-8 items-center justify-center gap-1.5 border-l py-1 outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {content}
            </Button>
          ) : (
            <div
              key={day}
              aria-current={isToday ? 'date' : undefined}
              className="flex items-center justify-center gap-1.5 border-l py-1"
            >
              {content}
            </div>
          );
        })}
      </div>
      {onSelectDay && <BookingTime days={days} onSelectDay={onSelectDay} />}
      {hasAllDay && (
        <div className={cn(columns, 'border-b')}>
          <Text
            as="span"
            size="xs"
            variant="muted"
            className="self-center px-1 text-right"
          >
            {messages.allDay}
          </Text>
          {days.map((day) => (
            <div
              key={day}
              className="flex min-w-0 flex-col gap-0.5 border-l p-0.5"
            >
              {(byDay.get(day) ?? [])
                .filter((event) => event.allDay)
                .map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    tabbable
                    onSelectEvent={onSelectEvent}
                  />
                ))}
            </div>
          ))}
        </div>
      )}
      <div
        ref={scroller}
        tabIndex={0}
        aria-label={label}
        className="min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div
          className={cn(columns, 'relative')}
          style={{ height: `${24 * HOUR_REM}rem` }}
        >
          <div className="relative">
            {Array.from({ length: 23 }, (_, index) => (
              <Text
                key={index}
                as="span"
                size="xs"
                variant="muted"
                className="absolute right-1 -translate-y-1/2 whitespace-nowrap tabular-nums"
                style={{ top: `${(index + 1) * HOUR_REM}rem` }}
              >
                {formatTime(new Date(2000, 0, 1, index + 1), { locale })}
              </Text>
            ))}
          </div>
          {days.map((day, dayIndex) => {
            const placed = layoutDay(byDay.get(day) ?? [], day, timeZone);
            const nowInZone = zoned(now, timeZone);
            const minutesNow = nowInZone.hour * 60 + nowInZone.minute;
            return (
              <div
                key={day}
                onClick={(event) => onColumnClick(event, day)}
                className={cn(
                  'relative border-l',
                  onSelectDay && 'cursor-pointer',
                )}
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${HOUR_REM}rem - 1px), var(--color-border) calc(${HOUR_REM}rem - 1px), var(--color-border) ${HOUR_REM}rem)`,
                }}
              >
                {loading && dayIndex % 2 === 0 && (
                  <Skeleton
                    className="absolute inset-x-1"
                    style={{
                      top: `${(9 + dayIndex / 2) * HOUR_REM}rem`,
                      height: `${HOUR_REM}rem`,
                    }}
                  />
                )}
                {placed.some((item) => item.columns > 3) && (
                  <div className="absolute inset-x-1 top-1 z-10 bg-background">
                    <MoreEvents
                      day={day}
                      events={byDay.get(day) ?? []}
                      hiddenCount={placed.length}
                      tabbable
                      onSelectEvent={onSelectEvent}
                    />
                  </div>
                )}
                {placed
                  .filter((item) => item.columns <= 3)
                  .map(({ event, top, bottom, column, columns: count }) => {
                    const color = colorOf(event.color);
                    const tall = bottom - top >= 45;
                    return (
                      <Button variant="plain" size={null}
                        key={event.id}
                        type="button"
                        onClick={() => onSelectEvent?.(event)}
                        className="absolute overflow-hidden rounded-sm bg-background text-left outline-none ring-1 ring-background focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring"
                        style={{
                          top: `${(top / 60) * HOUR_REM}rem`,
                          height: `${((bottom - top) / 60) * HOUR_REM}rem`,
                          left: `calc(${(column / count) * 100}% + 1px)`,
                          width: `calc(${100 / count}% - 2px)`,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute inset-0 border-l-2',
                            color.tint,
                            color.bar,
                          )}
                        />
                        <span
                          className={cn(
                            'relative flex min-w-0 px-1 py-0.5',
                            tall ? 'flex-col' : 'items-center gap-1',
                          )}
                        >
                          <Text
                            as="span"
                            size="xs"
                            weight="medium"
                            className="min-w-0 truncate"
                          >
                            {event.title}
                          </Text>
                          <Text
                            as="span"
                            size="xs"
                            variant="muted"
                            className="truncate tabular-nums"
                          >
                            {tall
                              ? `${time(event.start)} – ${time(event.end)}`
                              : time(event.start)}
                          </Text>
                          {event.detail && (
                            <span className="sr-only">, {event.detail}</span>
                          )}
                        </span>
                      </Button>
                    );
                  })}
                {day === nowInZone.toPlainDate().toString() && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive"
                    style={{ top: `${(minutesNow / 60) * HOUR_REM}rem` }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Agenda({
  label,
  view,
  date,
  events,
  onSelectDay,
  onSelectEvent,
  selectDayLabel,
  loading,
  today,
  empty,
}: SharedProps & { view: 'month' | 'week'; empty?: ReactNode }) {
  const { weekStartsOn, timeZone, messages, dayLabel, time } = useCalendar();
  const days =
    view === 'week'
      ? weekDays(date, weekStartsOn)
      : monthWeeks(date, weekStartsOn)
          .flat()
          .filter((day) => sameMonth(day, date));
  const byDay = eventsByDay(events, days, timeZone);
  const shown = onSelectDay
    ? days
    : days.filter((day) => (byDay.get(day) ?? []).length > 0);
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  // The list opens at today, or at the first day after it, when the period holds one.
  const start = shown.find((day) => day >= today);
  useLayoutEffect(() => {
    const element = list.current;
    const section =
      start === undefined
        ? null
        : element?.querySelector<HTMLElement>(`[data-day="${start}"]`);
    // The list is the sections' offset parent.
    if (element && section) element.scrollTop = section.offsetTop;
  }, [start, loading]);

  if (loading) {
    return (
      <div
        role="region"
        aria-label={label}
        aria-busy="true"
        className="flex flex-col gap-stack"
      >
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col gap-inline">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (shown.length === 0) {
    return (
      <div role="region" aria-label={label}>
        {empty ?? <EmptyState title={messages.empty} />}
      </div>
    );
  }

  return (
    <div
      ref={list}
      role="region"
      aria-label={label}
      className="relative flex min-h-0 flex-1 flex-col gap-stack overflow-y-auto"
    >
      {shown.map((day) => (
        <div
          role="group"
          key={day}
          data-day={day}
          aria-labelledby={`${id}-${day}`}
          className="flex flex-col gap-1"
        >
          <div className="flex items-center justify-between gap-inline">
            <Heading
              id={`${id}-${day}`}
              level={2}
              size="sm"
              variant={day < today ? 'muted' : 'default'}
              aria-current={day === today ? 'date' : undefined}
            >
              {dayLabel(day)}
              {day === today && (
                <Text
                  as="span"
                  size="xs"
                  variant="primary"
                  weight="medium"
                  className="ml-inline"
                >
                  {messages.today}
                </Text>
              )}
            </Heading>
            {onSelectDay && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={
                  selectDayLabel?.(day) ?? messages.selectDay(dayLabel(day))
                }
                onClick={() => onSelectDay(day)}
                className="max-mobile:size-11"
              >
                <Plus />
              </Button>
            )}
          </div>
          {(byDay.get(day) ?? []).length === 0 && (
            <Text size="sm" variant="muted">
              {messages.emptyDay}
            </Text>
          )}
          <ul className="flex flex-col overflow-hidden rounded-md border">
            {(byDay.get(day) ?? []).map((event) => {
              const color = colorOf(event.color);
              return (
                <li key={event.id} className="border-b last:border-b-0">
                  <Button variant="plain" size={null}
                    type="button"
                    onClick={() => onSelectEvent?.(event)}
                    className="flex min-h-11 w-full items-center gap-inset px-inset py-inline text-left outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden="true"
                      className={cn('w-1 self-stretch rounded-full', color.dot)}
                    />
                    {event.allDay ? (
                      <Text
                        as="span"
                        size="xs"
                        variant="muted"
                        className="w-16 shrink-0"
                      >
                        {messages.allDay}
                      </Text>
                    ) : (
                      <span className="flex w-16 shrink-0 flex-col">
                        <Text as="span" size="xs" className="tabular-nums">
                          {time(event.start)}
                        </Text>
                        <Text
                          as="span"
                          size="xs"
                          variant="muted"
                          className="tabular-nums"
                        >
                          <span className="sr-only">{messages.to} </span>
                          {time(event.end)}
                        </Text>
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Text
                        as="span"
                        size="sm"
                        weight="medium"
                        className="truncate"
                      >
                        {event.title}
                      </Text>
                      {event.detail && (
                        <Text
                          as="span"
                          size="xs"
                          variant="muted"
                          className="truncate"
                        >
                          {event.detail}
                        </Text>
                      )}
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function BookingTime({
  days,
  onSelectDay,
}: {
  days: string[];
  onSelectDay: (day: string, time?: string) => void;
}) {
  const { dayLabel, messages } = useCalendar();
  const [day, setDay] = useState(days[0]!);
  const [time, setTime] = useState('09:00');
  const id = useId();
  const selectedDay = days.includes(day) ? day : days[0]!;
  return (
    <div className="flex min-w-[56rem] items-end gap-inline border-b p-inline">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{messages.book}</Label>
        <Select
          value={selectedDay}
          onValueChange={setDay}
        >
          <SelectTrigger id={id}><SelectValue /></SelectTrigger>
          <SelectContent aria-label={messages.book}>{days.map((value) => (
            <SelectItem key={value} value={value}>
              {dayLabel(value)}
            </SelectItem>
          ))}</SelectContent>
        </Select>
      </div>
      <TimeInput label={messages.time} value={time} onChange={setTime} />
      <Button
        variant="outline"
        disabled={!time}
        onClick={() => onSelectDay(selectedDay, time)}
      >
        {messages.book}
      </Button>
    </div>
  );
}
