import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from './ui/table';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import { cn } from '../lib/utils';
import { Text } from './ui/text';

export type ChartSeries<Row> = {
  key: string;
  label: string;
  /** null/undefined means missing, not zero. Non-finite numbers produce an error state. */
  value: (row: Row) => number | null | undefined;
};
export type ChartMessages = {
  viewData: string;
  labelColumn: string;
  missing: string;
  missingNotice: string;
  empty: string;
  invalid: string;
  keyboard: string;
  dismiss: string;
};
const MESSAGES: ChartMessages = {
  viewData: 'View data',
  labelColumn: 'Label',
  missing: 'No value',
  missingNotice: 'Some values are missing. View the data table for details.',
  empty: 'No data to display.',
  invalid: 'The chart contains invalid numeric values.',
  keyboard:
    'Use Left and Right arrows to inspect values. Escape dismisses the details.',
  dismiss: 'Dismiss details',
};
export type ChartProps<Row> = {
  label: string;
  rows: Row[];
  x: (row: Row) => string;
  series: ChartSeries<Row>[];
  formatValue?: (value: number) => string;
  locale?: string;
  height?: number;
  className?: string;
  messages?: Partial<ChartMessages>;
};
const TOP = 8;
const BOTTOM = 24;
const LEFT = 56;
const RIGHT = 16;
const SERIES_TEXT = [
  'text-chart-1',
  'text-chart-2',
  'text-chart-3',
  'text-chart-4',
  'text-chart-5',
];
const DASHES = ['', '8 4', '2 4', '10 3 2 3', '4 3'];
export function chartColorClass(index: number): string {
  return SERIES_TEXT[index % SERIES_TEXT.length]!;
}
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      if (element.clientWidth > 0) setWidth(element.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  });
  return [ref, width] as const;
}

/** A signed domain including zero, with five-ish readable intervals. */
export function chartDomain(values: number[]) {
  let min = 0;
  let max = 0;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const rough = (max - min || 1) / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((n) => n * power).find((n) => n >= rough) ??
    power * 10;
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step || (low === 0 ? 1 : 0);
  return { low, high, step };
}
function shown(
  value: number | null | undefined,
  format: (value: number) => string,
  messages: ChartMessages,
) {
  return value == null
    ? messages.missing
    : Number.isFinite(value)
      ? format(value)
      : messages.invalid;
}
function DataTable<Row>({
  label,
  rows,
  x,
  series,
  format,
  messages,
}: ChartProps<Row> & {
  format: (value: number) => string;
  messages: ChartMessages;
}) {
  return (
    <Collapsible className="min-w-0">
      <CollapsibleTrigger asChild>
        <Button variant="link" size="sm" className="px-0">
          {messages.viewData}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-inline max-w-full overflow-x-auto">
        <Table containerClassName="overflow-visible" className="w-full border-collapse text-left text-sm">
          <TableCaption className="sr-only">{label}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="border-b p-inline">
                {messages.labelColumn}
              </TableHead>
              {series.map((s) => (
                <TableHead key={s.key} scope="col" className="border-b p-inline">
                  {s.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                <TableHead scope="row" className="border-b p-inline font-medium">
                  {x(row)}
                </TableHead>
                {series.map((s) => (
                  <TableCell key={s.key} className="border-b p-inline tabular-nums">
                    {shown(s.value(row), format, messages)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  );
}
function Legend<Row>({
  series,
  patternId,
}: {
  series: ChartSeries<Row>[];
  patternId?: string;
}) {
  return (
    <ul className="flex flex-wrap gap-x-stack gap-y-1">
      {series.map((s, index) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <svg
            width="24"
            height="12"
            aria-hidden="true"
            className={chartColorClass(index)}
          >
            <line
              x1="0"
              x2="24"
              y1="6"
              y2="6"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={DASHES[index % DASHES.length]}
            />
            {patternId && (
              <rect
                x="0"
                y="1"
                width="24"
                height="10"
                fill={`url(#${patternId}-pattern-${index})`}
              />
            )}
            <text x="9" y="10" className="fill-foreground text-2xs">
              {index + 1}
            </text>
          </svg>
          <Text as="span" size="xs">
            {s.label}
          </Text>
        </li>
      ))}
    </ul>
  );
}
function ValueAxis({
  domain,
  width,
  height,
  y,
  format,
}: {
  domain: ReturnType<typeof chartDomain>;
  width: number;
  height: number;
  y: (value: number) => number;
  format: (value: number) => string;
}) {
  const count = Math.round((domain.high - domain.low) / domain.step);
  return (
    <g aria-hidden="true">
      {Array.from(
        { length: Math.min(count + 1, 20) },
        (_, index) => domain.low + index * domain.step,
      ).map((value) => (
        <g key={value}>
          <line
            x1={LEFT}
            x2={width - RIGHT}
            y1={y(value)}
            y2={y(value)}
            className={value === 0 ? 'stroke-foreground' : 'stroke-border'}
            strokeDasharray={value === 0 ? undefined : '2 4'}
          />
          <text
            x={LEFT - 8}
            y={y(value)}
            dy="0.32em"
            textAnchor="end"
            className="fill-muted-foreground text-xs tabular-nums"
          >
            {format(value)}
          </text>
        </g>
      ))}
      <path
        d={`M${LEFT},${TOP}V${height - BOTTOM}`}
        className="stroke-border"
        fill="none"
      />
    </g>
  );
}
function useActiveRow(count: number, indexAt: (offset: number) => number) {
  const [active, setActive] = useState<number | null>(null);
  return {
    active: active !== null && active < count ? active : null,
    clear: () => setActive(null),
    handlers: {
      onPointerMove: (event: PointerEvent<SVGSVGElement>) => {
        if (count)
          setActive(
            indexAt(
              event.clientX - event.currentTarget.getBoundingClientRect().left,
            ),
          );
      },
      onFocus: () => {
        if (count) setActive(0);
      },
      onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => {
        if (!count) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const delta = event.key === 'ArrowRight' ? 1 : -1;
          setActive((current) =>
            Math.min(
              count - 1,
              Math.max(0, (current ?? (delta > 0 ? -1 : count)) + delta),
            ),
          );
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setActive(null);
        }
      },
    },
  };
}
function Details<Row>({
  row,
  x,
  series,
  format,
  messages,
  dismiss,
}: {
  row: Row;
  x: (row: Row) => string;
  series: ChartSeries<Row>[];
  format: (value: number) => string;
  messages: ChartMessages;
  dismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="absolute right-0 top-0 z-10 flex max-w-full flex-col gap-1 rounded-md border bg-popover p-inline text-sm text-foreground shadow-md"
    >
      <strong>{x(row)}</strong>
      {series.map((s) => (
        <span key={s.key}>
          {s.label}: {shown(s.value(row), format, messages)}
        </span>
      ))}
      <Button variant="plain" size={null}
        type="button"
        onClick={dismiss}
        className="min-h-6 text-left text-xs underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {messages.dismiss}
      </Button>
    </div>
  );
}

function Chart<Row>({
  label,
  rows,
  x,
  series,
  formatValue,
  locale,
  height = 240,
  className,
  messages: overrides,
  area = false,
  stacked = false,
}: ChartProps<Row> & { area?: boolean; stacked?: boolean }) {
  const messages = { ...MESSAGES, ...overrides };
  const format =
    formatValue ??
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format;
  const [ref, width] = useWidth();
  const id = useId();
  const values = rows.map((row) => series.map((s) => s.value(row)));
  const invalidValues = values.some((row) =>
    row.some((value) => value != null && !Number.isFinite(value)),
  );
  const missing = values.some((row) => row.some((value) => value == null));
  const finite = values
    .flat()
    .filter(
      (value): value is number => value != null && Number.isFinite(value),
    );
  const empty = !rows.length || !series.length || !finite.length;
  const domain = chartDomain(
    stacked
      ? values.flatMap((row) => [
          row.reduce<number>((sum, n) => sum + (n != null && n > 0 ? n : 0), 0),
          row.reduce<number>((sum, n) => sum + (n != null && n < 0 ? n : 0), 0),
        ])
      : finite,
  );
  const invalid =
    invalidValues ||
    !Number.isFinite(domain.low) ||
    !Number.isFinite(domain.high) ||
    !Number.isFinite(domain.high - domain.low);
  const plotHeight = Math.max(1, height - TOP - BOTTOM);
  const plotWidth = Math.max(1, width - LEFT - RIGHT);
  const y = (value: number) =>
    TOP + ((domain.high - value) / (domain.high - domain.low)) * plotHeight;
  const band = plotWidth / Math.max(1, rows.length);
  const at = (index: number) =>
    stacked
      ? LEFT + (index + 0.5) * band
      : LEFT + (index * plotWidth) / Math.max(1, rows.length - 1);
  const pointer = useActiveRow(rows.length, (offset) =>
    Math.min(
      rows.length - 1,
      Math.max(
        0,
        stacked
          ? Math.floor((offset - LEFT) / band)
          : Math.round(
              ((offset - LEFT) / plotWidth) * Math.max(1, rows.length - 1),
            ),
      ),
    ),
  );
  const active = pointer.active === null ? undefined : rows[pointer.active];
  const every = Math.max(
    1,
    Math.ceil(rows.length / Math.max(1, Math.floor(plotWidth / 72))),
  );
  return (
    <figure
      className={cn('m-0 flex min-w-0 flex-col gap-inline', className)}
      aria-label={label}
    >
      <Legend series={series} patternId={stacked ? id : undefined} />
      {invalid ? (
        <Text role="alert" variant="destructive">
          {messages.invalid}
        </Text>
      ) : empty ? (
        <Text role="status" variant="muted">
          {messages.empty}
        </Text>
      ) : (
        <div
          ref={ref}
          className="relative w-full"
          onPointerLeave={pointer.clear}
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              pointer.clear();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') pointer.clear();
          }}
        >
          <span id={`${id}-help`} className="sr-only">
            {messages.keyboard}
          </span>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={label}
            aria-describedby={`${id}-help`}
            tabIndex={0}
            className="block max-w-full overflow-visible rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...pointer.handlers}
          >
            <defs>
              {series.map((s, index) => (
                <pattern
                  key={s.key}
                  id={`${id}-pattern-${index}`}
                  width={6 + index * 2}
                  height={6 + index * 2}
                  patternUnits="userSpaceOnUse"
                  patternTransform={`rotate(${index * 30})`}
                  className={chartColorClass(index)}
                >
                  <rect width="100%" height="100%" fill="currentColor" />
                  <line
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="20"
                    className="stroke-background"
                    strokeWidth={index === 0 ? 0 : 2}
                  />
                </pattern>
              ))}
            </defs>
            <ValueAxis
              domain={domain}
              width={width}
              height={height}
              y={y}
              format={format}
            />
            <g aria-hidden="true">
              {rows.map((row, index) =>
                index % every === 0 ? (
                  <text
                    key={index}
                    x={at(index)}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-muted-foreground text-xs"
                  >
                    {x(row)}
                  </text>
                ) : null,
              )}
            </g>
            {stacked
              ? rows.map((row, rowIndex) => {
                  let positive = 0;
                  let negative = 0;
                  return (
                    <g key={rowIndex}>
                      {series.map((s, index) => {
                        const value = s.value(row);
                        if (value == null || !Number.isFinite(value))
                          return null;
                        const start = value >= 0 ? positive : negative;
                        const end = start + value;
                        if (value >= 0) positive = end;
                        else negative = end;
                        return (
                          <rect
                            key={s.key}
                            data-series={s.key}
                            data-value={value}
                            x={at(rowIndex) - Math.min(48, band * 0.6) / 2}
                            y={Math.min(y(start), y(end))}
                            width={Math.min(48, band * 0.6)}
                            height={Math.abs(y(start) - y(end))}
                            fill={`url(#${id}-pattern-${index})`}
                            className={chartColorClass(index)}
                          />
                        );
                      })}
                    </g>
                  );
                })
              : series.map((s, index) => {
                  const segments: { x: number; y: number; value: number }[][] =
                    [];
                  let segment: { x: number; y: number; value: number }[] = [];
                  rows.forEach((row, rowIndex) => {
                    const value = s.value(row);
                    if (value == null) {
                      if (segment.length) segments.push(segment);
                      segment = [];
                    } else
                      segment.push({ x: at(rowIndex), y: y(value), value });
                  });
                  if (segment.length) segments.push(segment);
                  return (
                    <g key={s.key} className={chartColorClass(index)}>
                      {segments.map((points, segmentIndex) => {
                        const line = `M${points.map((p) => `${p.x},${p.y}`).join('L')}`;
                        return (
                          <g key={segmentIndex}>
                            {area && (
                              <path
                                d={`${line}L${points[points.length - 1]!.x},${y(0)}L${points[0]!.x},${y(0)}Z`}
                                fill="currentColor"
                                opacity="0.12"
                              />
                            )}
                            <path
                              data-series={s.key}
                              d={line}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeDasharray={DASHES[index % DASHES.length]}
                            />
                            {points.map((point, pointIndex) =>
                              index % 2 === 0 ? (
                                <circle
                                  key={pointIndex}
                                  data-value={point.value}
                                  cx={point.x}
                                  cy={point.y}
                                  r="3"
                                  fill="currentColor"
                                />
                              ) : (
                                <rect
                                  key={pointIndex}
                                  data-value={point.value}
                                  x={point.x - 3}
                                  y={point.y - 3}
                                  width="6"
                                  height="6"
                                  fill="currentColor"
                                />
                              ),
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
          </svg>
          {active !== undefined && (
            <Details
              row={active}
              x={x}
              series={series}
              format={format}
              messages={messages}
              dismiss={() => {
                ref.current?.querySelector('svg')?.focus();
                pointer.clear();
              }}
            />
          )}
        </div>
      )}
      {missing && !invalid && (
        <Text size="sm" variant="muted">
          {messages.missingNotice}
        </Text>
      )}
      <DataTable
        label={label}
        rows={rows}
        x={x}
        series={series}
        format={format}
        messages={messages}
      />
    </figure>
  );
}
export function LineChart<Row>(props: ChartProps<Row> & { area?: boolean }) {
  return <Chart {...props} />;
}
export function StackedBarChart<Row>(props: ChartProps<Row>) {
  return <Chart {...props} stacked />;
}
export type SparklineProps = {
  label: string;
  values: (number | null | undefined)[];
  color?: number;
  height?: number;
  className?: string;
  messages?: Pick<Partial<ChartMessages>, 'empty' | 'invalid'>;
};
export function Sparkline({
  label,
  values,
  color = 0,
  height = 32,
  className,
  messages,
}: SparklineProps) {
  const [ref, width] = useWidth();
  const finite = values.filter(
    (n): n is number => n != null && Number.isFinite(n),
  );
  const min = finite.length ? Math.min(...finite) : 0;
  const range = finite.length ? Math.max(...finite) - min || 1 : 1;
  if (
    values.some((n) => n != null && !Number.isFinite(n)) ||
    !Number.isFinite(range)
  )
    return (
      <Text role="alert" variant="destructive">
        {messages?.invalid ?? MESSAGES.invalid}
      </Text>
    );
  if (!finite.length)
    return (
      <Text role="status" variant="muted">
        {messages?.empty ?? MESSAGES.empty}
      </Text>
    );
  const at = (index: number) =>
    3 + ((width - 6) * index) / Math.max(1, values.length - 1);
  const y = (value: number) => 3 + (height - 6) * (1 - (value - min) / range);
  let newSegment = true;
  const path = values
    .map((value, index) => {
      if (value == null) {
        newSegment = true;
        return '';
      }
      const command = newSegment ? 'M' : 'L';
      newSegment = false;
      return `${command}${at(index)},${y(value)}`;
    })
    .join('');
  return (
    <div ref={ref} className={cn('w-full min-w-16', className)}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={label}
        className={cn(
          'block max-w-full overflow-visible',
          chartColorClass(color),
        )}
      >
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
        {values.map((value, index) =>
          value == null ? null : (
            <circle
              key={index}
              cx={at(index)}
              cy={y(value)}
              r="2"
              fill="currentColor"
            />
          ),
        )}
      </svg>
    </div>
  );
}
