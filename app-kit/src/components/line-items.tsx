import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table';
import { Fragment, useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { useIsMobile } from '../hooks/use-breakpoint';
import { formatCurrency, formatPercent } from '../lib/format';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Skeleton } from './ui/skeleton';
import { Text } from './ui/text';

export type LineItem = {
  id: string | number;
  description: string;
  /** How many; up to three decimals, such as 2.5 hours. `NaN` while the cell holds no number. */
  quantity: number;
  /** The price of one, in major units such as euros. It rounds to the currency's minor unit. */
  unitPrice: number;
  /** Percent: 25 is 25%. */
  taxRate: number;
};

export type LineItemField = 'description' | 'quantity' | 'unitPrice' | 'taxRate';
export type LineItemErrors = Partial<Record<LineItemField, string>>;

/** The amounts of lines, in whole minor units such as cents: divide by 10^digits for `formatCurrency`. */
export type LineItemTotals = {
  /** Each line's amounts, in the order of the lines. */
  lines: { net: number; tax: number; total: number }[];
  subtotal: number;
  tax: number;
  total: number;
  /** The tax of each rate, highest rate first. */
  taxes: { rate: number; amount: number }[];
  /** The currency's minor-unit digits: 2 for EUR, 0 for JPY. */
  digits: number;
};

const QUANTITY_DIGITS = 3;
const RATE_DIGITS = 2;
const digitsCache = new Map<string, number>();

/** The minor-unit digits of `currency` (ISO 4217): 2 for EUR, 0 for JPY. */
export function currencyDigits(currency: string): number {
  let digits = digitsCache.get(currency);
  if (digits === undefined) {
    digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
    digitsCache.set(currency, digits);
  }
  return digits;
}

/**
 * `amount` as a whole number of minor units, rounded half up. It shifts the decimal digits as
 * written, so 1.005 at 2 digits is 101, where `1.005 * 100` gives 100.49999….
 */
export function toMinorUnits(amount: number, digits: number): number {
  if (!Number.isFinite(amount)) return 0;
  const [mantissa, exponent = '0'] = String(amount).split('e');
  return Math.round(Number(`${mantissa}e${Number(exponent) + digits}`));
}

/** Minor units back to an amount for `formatCurrency`. */
export function fromMinorUnits(minor: number, digits: number): number {
  return minor / 10 ** digits;
}

/** What is wrong with each cell of a line; empty when the line can be saved. */
export function lineItemErrors(line: LineItem): LineItemErrors {
  const errors: LineItemErrors = {};
  if (line.description.trim() === '') errors.description = 'Enter a description.';
  if (!Number.isFinite(line.quantity) || line.quantity <= 0) errors.quantity = 'Enter a quantity above 0.';
  if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) errors.unitPrice = 'Enter a price of 0 or more.';
  if (!Number.isFinite(line.taxRate) || line.taxRate < 0 || line.taxRate > 100) errors.taxRate = 'Enter a tax rate from 0 to 100.';
  return errors;
}

/** True when every line can be saved. */
export function lineItemsValid(lines: LineItem[]): boolean {
  return lines.every((line) => Object.keys(lineItemErrors(line)).length === 0);
}

/**
 * The amounts of `lines` in `currency`, worked out in whole minor units so no float drift creeps
 * in: 3 × 19.99 is exactly 59.97. A line's amount and its tax each round half up to the minor unit,
 * as an invoice prints them, and the totals add the rounded lines. A line with an invalid number
 * counts as nothing.
 */
export function lineItemTotals(lines: LineItem[], currency: string): LineItemTotals {
  const digits = currencyDigits(currency);
  const byRate = new Map<number, number>();
  const amounts = lines.map((line) => {
    const errors = lineItemErrors(line);
    if (errors.quantity || errors.unitPrice || errors.taxRate) return { net: 0, tax: 0, total: 0 };
    const quantity = toMinorUnits(line.quantity, QUANTITY_DIGITS);
    const price = toMinorUnits(line.unitPrice, digits);
    const rate = toMinorUnits(line.taxRate, RATE_DIGITS);
    // Each product of whole numbers is exact; the one division rounds once.
    const net = Math.round((quantity * price) / 10 ** QUANTITY_DIGITS);
    const tax = Math.round((net * rate) / (100 * 10 ** RATE_DIGITS));
    if (tax > 0 || rate > 0) byRate.set(line.taxRate, (byRate.get(line.taxRate) ?? 0) + tax);
    return { net, tax, total: net + tax };
  });
  const subtotal = amounts.reduce((sum, line) => sum + line.net, 0);
  const tax = amounts.reduce((sum, line) => sum + line.tax, 0);
  return {
    lines: amounts,
    subtotal,
    tax,
    total: subtotal + tax,
    taxes: [...byRate].map(([rate, amount]) => ({ rate, amount })).sort((a, b) => b.rate - a.rate),
    digits,
  };
}

/** A number as typed: a comma or a point for decimals, spaces ignored. `NaN` for anything else. */
function parseNumber(text: string): number {
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  return /^-?(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

export type LineItemsProps = {
  lines: LineItem[];
  /** Every edit, add and remove; keep the lines in state and save them when the member saves. */
  onChange?: (lines: LineItem[]) => void;
  /** ISO 4217, such as "EUR": the amounts' currency and minor unit. */
  currency: string;
  /** Plain text and no add or remove, as for a confirmed order. */
  readOnly?: boolean;
  /** Inputs that cannot change, as while a save is on its way. */
  disabled?: boolean;
  /** Shows every cell's error, not only those the member has left; set it when a save is refused. */
  showErrors?: boolean;
  /** Skeleton lines while the lines load. */
  loading?: boolean;
  /** The tax rate of the first line added to an empty list; later lines take the last line's rate. */
  defaultTaxRate?: number;
  /** More buttons beside Add line, such as a product picker that adds a line. */
  actions?: ReactNode;
  /** The accessible name of the lines. */
  label?: string;
  className?: string;
};

type Focus = { index: number; field: LineItemField | 'remove' } | 'add' | null;

const NUMBER_INPUT = 'text-right tabular-nums';
/** Cells read as text until hovered or focused, so a table of inputs stays quiet. */
const CELL_INPUT = 'h-9 px-2 border-transparent hover:border-input focus-visible:border-input disabled:hover:border-transparent';
const PHONE_TARGET = 'max-mobile:h-11';
const FIELD_NAMES: Record<LineItemField, string> = {
  description: 'Description',
  quantity: 'Quantity',
  unitPrice: 'Unit price',
  taxRate: 'Tax %',
};

/**
 * Lines of an order, quote or invoice: description, quantity, unit price and tax, each line's
 * amount, and the subtotal, tax and total under them. Tab moves through the cells; Enter in a
 * line's last cell goes to the next line, or adds one after the last. A removed line can be put
 * back from the notice that replaces it. An error shows once the member leaves a cell, or at once
 * with `showErrors`. On a phone each line is a card.
 */
export function LineItems({
  lines,
  onChange,
  currency,
  readOnly = false,
  disabled = false,
  showErrors = false,
  loading = false,
  defaultTaxRate = 0,
  actions,
  label = 'Line items',
  className,
}: LineItemsProps) {
  const baseId = useId();
  const phone = useIsMobile();
  const root = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const nextId = useRef(0);
  const focusAfter = useRef<Focus>(null);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [removed, setRemoved] = useState<{ line: LineItem; index: number } | null>(null);
  const totals = lineItemTotals(lines, currency);
  const money = (minor: number) => formatCurrency(fromMinorUnits(minor, totals.digits), currency);
  const editable = !readOnly && onChange !== undefined;

  useEffect(() => {
    const target = focusAfter.current;
    if (target === null) return;
    focusAfter.current = null;
    if (target === 'add') {
      addButton.current?.focus();
      return;
    }
    root.current
      ?.querySelector<HTMLElement>(`[data-line-index="${target.index}"][data-field="${target.field}"]`)
      ?.focus();
  }, [lines]);

  function change(next: LineItem[]) {
    setRemoved(null);
    onChange?.(next);
  }

  function edit(index: number, values: Partial<LineItem>) {
    change(lines.map((line, at) => (at === index ? { ...line, ...values } : line)));
  }

  function add() {
    nextId.current += 1;
    const last = lines[lines.length - 1];
    focusAfter.current = { index: lines.length, field: 'description' };
    change([
      ...lines,
      {
        id: `${baseId}new${nextId.current}`,
        description: '',
        quantity: 1,
        unitPrice: Number.NaN,
        taxRate: last && Number.isFinite(last.taxRate) ? last.taxRate : defaultTaxRate,
      },
    ]);
  }

  function remove(index: number) {
    focusAfter.current = lines.length > 1 ? { index: Math.min(index, lines.length - 2), field: 'remove' } : 'add';
    onChange?.(lines.filter((_, at) => at !== index));
    setRemoved({ line: lines[index]!, index });
  }

  function undo() {
    if (!removed) return;
    const index = Math.min(removed.index, lines.length);
    focusAfter.current = { index, field: 'description' };
    change([...lines.slice(0, index), removed.line, ...lines.slice(index)]);
  }

  function onLastCellKey(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (index === lines.length - 1) add();
    else root.current?.querySelector<HTMLElement>(`[data-line-index="${index + 1}"][data-field="description"]`)?.focus();
  }

  const touch = (line: LineItem, field: LineItemField) => {
    const key = `${line.id}:${field}`;
    if (!touched.has(key)) setTouched(new Set(touched).add(key));
  };
  const shownErrors = (line: LineItem): LineItemErrors => {
    const errors = lineItemErrors(line);
    if (showErrors) return errors;
    return Object.fromEntries(
      Object.entries(errors).filter(([field]) => touched.has(`${line.id}:${field}`)),
    ) as LineItemErrors;
  };

  const cell = (line: LineItem, index: number, field: LineItemField, errors: LineItemErrors) => {
    const error = errors[field];
    const props = {
      id: `${baseId}-${index}-${field}`,
      'data-line-index': index,
      'data-field': field,
      disabled,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${baseId}-${index}-${field}-error` : undefined,
      onBlur: () => touch(line, field),
      className: cn(phone ? PHONE_TARGET : CELL_INPUT, field !== 'description' && NUMBER_INPUT),
    };
    if (field === 'description') {
      return (
        <Input
          {...props}
          autoComplete="off"
          aria-label={phone ? undefined : `Description, line ${index + 1}`}
          value={line.description}
          onChange={(event) => edit(index, { description: event.target.value })}
        />
      );
    }
    return (
      <NumberInput
        {...props}
        aria-label={phone ? undefined : `${FIELD_NAMES[field]}, line ${index + 1}`}
        value={line[field]}
        format={(value) =>
          field === 'unitPrice'
            ? fromMinorUnits(toMinorUnits(value, totals.digits), totals.digits).toFixed(totals.digits)
            : String(value)
        }
        onValue={(value) => edit(index, { [field]: value } as Partial<LineItem>)}
        onKeyDown={field === 'taxRate' ? (event) => onLastCellKey(event, index) : undefined}
      />
    );
  };

  const errorText = (index: number, field: LineItemField, message: string | undefined) =>
    message && (
      <Text key={field} id={`${baseId}-${index}-${field}-error`} as="span" size="xs" variant="destructive">
        {message}
      </Text>
    );

  const removeButton = (line: LineItem, index: number) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-line-index={index}
      data-field="remove"
      disabled={disabled}
      aria-label={`Remove ${line.description.trim() || `line ${index + 1}`}`}
      onClick={() => remove(index)}
      className={cn('text-muted-foreground hover:text-destructive-text', phone ? 'size-11' : 'size-8')}
    >
      <Trash2 />
    </Button>
  );

  const fields: LineItemField[] = ['description', 'quantity', 'unitPrice', 'taxRate'];
  const noLines = !loading && lines.length === 0;

  return (
    <div ref={root} className={cn('flex flex-col gap-stack', className)}>
      {phone ? (
        <ol aria-label={label} className="flex flex-col gap-inline">
          {loading &&
            [0, 1].map((row) => (
              <li key={row} className="flex flex-col gap-inline rounded-lg border p-inset">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </li>
            ))}
          {noLines && (
            <li className="rounded-lg border border-dashed p-inset text-center">
              <Text size="sm" variant="muted">
                {editable ? 'No lines yet.' : 'No lines.'}
              </Text>
            </li>
          )}
          {!loading &&
            lines.map((line, index) => {
              const amount = money(totals.lines[index]!.net);
              if (!editable) {
                return (
                  <li key={line.id} className="flex items-start justify-between gap-stack rounded-lg border p-inset">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Text size="sm" weight="medium" className="break-words">
                        {line.description}
                      </Text>
                      <Text size="xs" variant="muted" className="tabular-nums">
                        {line.quantity} × {money(toMinorUnits(line.unitPrice, totals.digits))} ·{' '}
                        {formatPercent(line.taxRate / 100, { maximumFractionDigits: 2 })} tax
                      </Text>
                    </div>
                    <Text size="sm" weight="medium" className="shrink-0 tabular-nums">
                      {amount}
                    </Text>
                  </li>
                );
              }
              const errors = shownErrors(line);
              return (
                <li key={line.id} className="flex flex-col gap-inset rounded-lg border p-inset">
                  {(['description', 'numbers'] as const).map((group) => (
                    <div key={group} className={group === 'numbers' ? 'grid grid-cols-3 gap-inline' : 'contents'}>
                      {fields
                        .filter((field) => (field === 'description') === (group === 'description'))
                        .map((field) => (
                          <div key={field} className="flex min-w-0 flex-col gap-1.5">
                            <Label htmlFor={`${baseId}-${index}-${field}`}>
                              {FIELD_NAMES[field]}
                              <span className="sr-only">, line {index + 1}</span>
                            </Label>
                            {cell(line, index, field, errors)}
                            {errorText(index, field, errors[field])}
                          </div>
                        ))}
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-inline">
                    <Text size="sm" variant="muted">
                      Amount <span className="font-medium text-foreground tabular-nums">{amount}</span>
                    </Text>
                    {removeButton(line, index)}
                  </div>
                </li>
              );
            })}
        </ol>
      ) : (
        <div className="overflow-x-auto">
          <Table containerClassName="overflow-visible" aria-label={label} className="w-full min-w-[34rem] table-fixed border-collapse text-sm">
            <colgroup>
              <col />
              <col className="w-24" />
              <col className="w-32" />
              <col className="w-24" />
              <col className="w-32" />
              {editable && <col className="w-12" />}
            </colgroup>
            <TableHeader>
              <TableRow className="border-b">
                <Head>Description</Head>
                <Head number>Quantity</Head>
                <Head number>Unit price</Head>
                <Head number>Tax %</Head>
                <Head number>Amount</Head>
                {editable && (
                  <TableHead scope="col">
                    <span className="sr-only">Remove</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                [0, 1, 2].map((row) => (
                  <TableRow key={row} className="border-b">
                    {[0, 1, 2, 3, 4].map((column) => (
                      <TableCell key={column} className="px-inline py-inset">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                    {editable && <TableCell />}
                  </TableRow>
                ))}
              {noLines && (
                <TableRow className="border-b">
                  <TableCell colSpan={editable ? 6 : 5} className="px-inline py-stack text-center">
                    <Text size="sm" variant="muted">
                      {editable ? 'No lines yet.' : 'No lines.'}
                    </Text>
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                lines.map((line, index) => {
                  const amount = money(totals.lines[index]!.net);
                  if (!editable) {
                    return (
                      <TableRow key={line.id} className="border-b align-top">
                        <TableCell className="px-inline py-inset break-words">{line.description}</TableCell>
                        <TableCell className="px-inline py-inset text-right tabular-nums">{line.quantity}</TableCell>
                        <TableCell className="px-inline py-inset text-right tabular-nums">
                          {money(toMinorUnits(line.unitPrice, totals.digits))}
                        </TableCell>
                        <TableCell className="px-inline py-inset text-right tabular-nums">
                          {formatPercent(line.taxRate / 100, { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="px-inline py-inset text-right tabular-nums">{amount}</TableCell>
                      </TableRow>
                    );
                  }
                  const errors = shownErrors(line);
                  const messages = fields.map((field) => errorText(index, field, errors[field])).filter(Boolean);
                  return [
                    <TableRow key={line.id} className={cn(messages.length === 0 && 'border-b')}>
                      {fields.map((field) => (
                        <TableCell key={field} className="p-1">
                          {cell(line, index, field, errors)}
                        </TableCell>
                      ))}
                      <TableCell className="px-inline py-1 text-right tabular-nums">{amount}</TableCell>
                      <TableCell className="p-1 text-center">{removeButton(line, index)}</TableCell>
                    </TableRow>,
                    messages.length > 0 && (
                      <TableRow key={`${line.id}-errors`} className="border-b">
                        <TableCell colSpan={6} className="px-inline pb-inline">
                          <span className="flex flex-wrap gap-x-stack gap-y-0.5">{messages}</span>
                        </TableCell>
                      </TableRow>
                    ),
                  ];
                })}
            </TableBody>
          </Table>
        </div>
      )}

      <div role="status" className={cn(!removed && 'sr-only')}>
        {removed && (
          <span className="flex items-center gap-inline rounded-md bg-muted px-inset py-1">
            <Text as="span" size="sm" className="min-w-0 flex-1 truncate">
              Removed {removed.line.description.trim() ? `“${removed.line.description.trim()}”` : 'a line'}.
            </Text>
            <Button type="button" variant="ghost" size="xs" onClick={undo} className={PHONE_TARGET}>
              Undo
            </Button>
          </span>
        )}
      </div>

      <div className="flex flex-col gap-stack mobile:flex-row mobile:items-start mobile:justify-between">
        {editable && (
          <div className="flex flex-wrap items-center gap-inline">
            <Button ref={addButton} type="button" variant="outline" size="sm" onClick={add} disabled={disabled} className={PHONE_TARGET}>
              <Plus />
              Add line
            </Button>
            {actions}
          </div>
        )}
        <div role="group" aria-label="Totals" className="w-full mobile:ml-auto mobile:w-auto mobile:min-w-64">
          <dl className="grid grid-cols-[1fr_auto] gap-y-inline">
            {loading ? (
              <Skeleton className="col-span-2 h-16 w-full" />
            ) : (
              <>
                <Text asChild size="sm" variant="muted">
                  <dt>Subtotal</dt>
                </Text>
                <Text asChild size="sm" className="pl-section text-right tabular-nums">
                  <dd>{money(totals.subtotal)}</dd>
                </Text>
                {totals.taxes.length === 0 ? (
                  <>
                    <Text asChild size="sm" variant="muted">
                      <dt>Tax</dt>
                    </Text>
                    <Text asChild size="sm" className="pl-section text-right tabular-nums">
                      <dd>{money(0)}</dd>
                    </Text>
                  </>
                ) : (
                  totals.taxes.map((tax) => (
                    <Fragment key={tax.rate}>
                      <Text asChild size="sm" variant="muted">
                        <dt>Tax {formatPercent(tax.rate / 100, { maximumFractionDigits: 2 })}</dt>
                      </Text>
                      <Text asChild size="sm" className="pl-section text-right tabular-nums">
                        <dd>{money(tax.amount)}</dd>
                      </Text>
                    </Fragment>
                  ))
                )}
                <Text asChild size="md" weight="semibold" className="border-t pt-inline">
                  <dt>Total</dt>
                </Text>
                <Text asChild size="md" weight="semibold" className="border-t pl-section pt-inline text-right tabular-nums">
                  <dd>{money(totals.total)}</dd>
                </Text>
              </>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

function Head({ children, number = false }: { children: ReactNode; number?: boolean }) {
  return (
    <Text asChild size="xs" weight="medium" variant="muted">
      <TableHead scope="col" className={cn('px-inline py-inline text-left', number && 'text-right')}>
        {children}
      </TableHead>
    </Text>
  );
}

/**
 * A number cell that keeps the text as typed, so "2." or "abc" stays on screen while `onValue`
 * reports `NaN` or the number so far. A new value from outside replaces text it no longer matches.
 */
function NumberInput({
  value,
  format,
  onValue,
  onBlur,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: number;
  format: (value: number) => string;
  onValue: (value: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const current = text !== null && Object.is(parseNumber(text), value) ? text : null;
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={current ?? (Number.isFinite(value) ? format(value) : '')}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        setText(event.target.value);
        onValue(parseNumber(event.target.value));
      }}
      onBlur={(event) => {
        if (current !== null && Number.isFinite(parseNumber(current))) setText(null);
        onBlur?.(event);
      }}
    />
  );
}
