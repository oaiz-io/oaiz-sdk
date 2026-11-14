/**
 * How an app shows numbers, money, dates and times: one place, so every screen
 * writes "€1.2k", "3 days ago" and "12 Mar 2027" the same way. Each formatter
 * takes an optional locale and otherwise uses the browser's.
 */

type Locale = string | undefined;

const cache = new Map<
  string,
  Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat
>();

function cached<
  T extends Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat,
>(key: string, make: () => T): T {
  let format = cache.get(key) as T | undefined;
  if (!format) {
    format = make();
    cache.set(key, format);
  }
  return format;
}

/** A plain number with grouping: 1,234.5. */
export function formatNumber(
  value: number,
  options: { locale?: Locale; maximumFractionDigits?: number } = {},
): string {
  const digits = options.maximumFractionDigits ?? 2;
  return cached(
    `n|${options.locale}|${digits}`,
    () =>
      new Intl.NumberFormat(options.locale, { maximumFractionDigits: digits }),
  ).format(value);
}

/** A short number for a figure that need not be exact: 1.2k, 3.4M. */
export function formatCompact(
  value: number,
  options: { locale?: Locale } = {},
): string {
  return cached(
    `c|${options.locale}`,
    () =>
      new Intl.NumberFormat(options.locale, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
  ).format(value);
}

/**
 * An amount of money in `currency` (ISO 4217, such as "EUR"); `compact` writes €1.2k and `whole`
 * writes €6,000 for amounts that are never in cents, such as deal values.
 */
export function formatCurrency(
  value: number,
  currency: string,
  options: { locale?: Locale; compact?: boolean; whole?: boolean } = {},
): string {
  const compact = options.compact ?? false;
  const whole = options.whole ?? false;
  return cached(
    `m|${options.locale}|${currency}|${compact}|${whole}`,
    () =>
      new Intl.NumberFormat(options.locale, {
        style: 'currency',
        currency,
        ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
        ...(whole && !compact
          ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
          : {}),
      }),
  ).format(value);
}

/** A share, where 1 is 100%: 0.256 becomes 25.6%. */
export function formatPercent(
  value: number,
  options: { locale?: Locale; maximumFractionDigits?: number } = {},
): string {
  const digits = options.maximumFractionDigits ?? 1;
  return cached(
    `p|${options.locale}|${digits}`,
    () =>
      new Intl.NumberFormat(options.locale, {
        style: 'percent',
        maximumFractionDigits: digits,
      }),
  ).format(value);
}

/**
 * A day of the member's own calendar as `YYYY-MM-DD`: the value of a date input and of a `date`
 * column. It reads the local date, never `toISOString()`, which gives the UTC day.
 */
export function localDay(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The local midnight a `YYYY-MM-DD` day starts at, or null for anything else. */
export function parseLocalDay(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return localDay(date) === day ? date : null;
}

function toDate(value: Date | string | number): Date | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const day = parseLocalDay(value);
    if (day) return day;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A date: 12 Mar 2027, or 12 Mar with `year: false` for dates in a list that all fall close to now.
 * A `YYYY-MM-DD` string is read as that day, wherever the member is.
 */
export function formatDate(
  value: Date | string | number,
  options: { locale?: Locale; year?: boolean } = {},
): string {
  const date = toDate(value);
  if (!date) return '';
  const year = options.year ?? true;
  return cached(
    `d|${options.locale}|${year}`,
    () =>
      new Intl.DateTimeFormat(options.locale, {
        day: 'numeric',
        month: 'short',
        ...(year ? { year: 'numeric' } : {}),
      }),
  ).format(date);
}

/** A date and time: 12 Mar 2027, 14:05. */
export function formatDateTime(
  value: Date | string | number,
  options: { locale?: Locale } = {},
): string {
  const date = toDate(value);
  if (!date) return '';
  return cached(
    `dt|${options.locale}`,
    () =>
      new Intl.DateTimeFormat(options.locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
  ).format(date);
}

/** A time of day on the member's clock: 14:05, or 2:05 PM where the locale writes it so. */
export function formatTime(
  value: Date | string | number,
  options: { locale?: Locale; timeZone?: string } = {},
): string {
  const date = toDate(value);
  if (!date) return '';
  return cached(
    `t|${options.locale}|${options.timeZone}`,
    () =>
      new Intl.DateTimeFormat(options.locale, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: options.timeZone,
      }),
  ).format(date);
}

/** The name of a day of the week: Mon, or Monday with `style: 'long'`, or M with `'narrow'`. */
export function formatWeekday(
  value: Date | string | number,
  options: { locale?: Locale; style?: 'long' | 'short' | 'narrow' } = {},
): string {
  const date = toDate(value);
  if (!date) return '';
  const style = options.style ?? 'short';
  return cached(
    `w|${options.locale}|${style}`,
    () => new Intl.DateTimeFormat(options.locale, { weekday: style }),
  ).format(date);
}

/** A month and its year: November 2026; `style: 'short'` writes Nov, for a chart axis of months. */
export function formatMonth(
  value: Date | string | number,
  options: { locale?: Locale; style?: 'long' | 'short' } = {},
): string {
  const date = toDate(value);
  if (!date) return '';
  const style = options.style ?? 'long';
  return cached(
    `mo|${options.locale}|${style}`,
    () =>
      new Intl.DateTimeFormat(
        options.locale,
        style === 'short'
          ? { month: 'short' }
          : { month: 'long', year: 'numeric' },
      ),
  ).format(date);
}

/** A day with its weekday, for a heading over that day's items: Monday 9 November. */
export function formatDay(
  value: Date | string | number,
  options: { locale?: Locale } = {},
): string {
  const date = toDate(value);
  if (!date) return '';
  return cached(
    `dy|${options.locale}`,
    () =>
      new Intl.DateTimeFormat(options.locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
  ).format(date);
}

/** A span of days written once where the ends share a month or year: 9 – 15 Nov 2026. */
export function formatDayRange(
  from: Date | string | number,
  to: Date | string | number,
  options: { locale?: Locale } = {},
): string {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return '';
  return (
    cached(
      `d|${options.locale}|true`,
      () =>
        new Intl.DateTimeFormat(options.locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
    ) as Intl.DateTimeFormat
  ).formatRange(start, end);
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.34524],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
];

/** How long ago or from now: "3 days ago", "in 2 hours", "now". */
export function formatRelative(
  value: Date | string | number,
  options: { locale?: Locale; now?: Date } = {},
): string {
  const date = toDate(value);
  if (!date) return '';
  const format = cached(
    `r|${options.locale}`,
    () => new Intl.RelativeTimeFormat(options.locale, { numeric: 'auto' }),
  );
  let amount = (date.getTime() - (options.now ?? new Date()).getTime()) / 1000;
  if (Math.abs(amount) < 45) return format.format(0, 'second');
  for (const [unit, size] of RELATIVE_STEPS) {
    // Compare the rounded amount, so 11.99 months reads as a year, not "12 months ago".
    if (Math.abs(Math.round(amount)) < size)
      return format.format(Math.round(amount), unit);
    amount /= size;
  }
  return format.format(Math.round(amount), 'year');
}
