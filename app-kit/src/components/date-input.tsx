import { useId, useState, type ReactNode } from 'react';
import { Temporal } from 'temporal-polyfill';

import { cn } from '../lib/utils';
import { FormField, FieldGroup } from './ui/form-field';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Text } from './ui/text';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export type DateInputProps = {
  label: string;
  /** A calendar day, YYYY-MM-DD. It is not an instant or a UTC timestamp. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: ReactNode;
  requiredLabel?: string;
  className?: string;
};

export function DateInput({
  label,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  error,
  hint,
  requiredLabel,
  className,
}: DateInputProps) {
  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      required={required}
      requiredLabel={requiredLabel}
      className={className}
    >
      {(control) => (
        <Input
          {...control}
          type="date"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="tabular-nums"
        />
      )}
    </FormField>
  );
}

export type DateRange = { from: string; to: string };
export type DateRangeMessages = {
  from: string;
  to: string;
  invalid: string;
  reversed: string;
  beforeMin: (min: string) => string;
  afterMax: (max: string) => string;
};
const RANGE_MESSAGES: DateRangeMessages = {
  from: 'from',
  to: 'to',
  invalid: 'Enter valid calendar dates.',
  reversed: 'The end date must be on or after the start date.',
  beforeMin: (min) => `Choose dates on or after ${min}.`,
  afterMax: (max) => `Choose dates on or before ${max}.`,
};

export function dateRangeError(
  value: DateRange,
  min?: string,
  max?: string,
  messages: DateRangeMessages = RANGE_MESSAGES,
): string | undefined {
  try {
    for (const date of [value.from, value.to].filter(Boolean)) {
      Temporal.PlainDate.from(date, { overflow: 'reject' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return messages.invalid;
      if (min && date < min) return messages.beforeMin(min);
      if (max && date > max) return messages.afterMax(max);
    }
  } catch {
    return messages.invalid;
  }
  if (value.from && value.to && value.from > value.to) return messages.reversed;
  return undefined;
}

export type DateRangeInputProps = {
  label: string;
  value: DateRange;
  onChange: (value: DateRange) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  error?: string;
  messages?: Partial<DateRangeMessages>;
  className?: string;
};

/** Native limits guide the picker; explicit validation also checks controlled or typed values. */
export function DateRangeInput({
  label,
  value,
  onChange,
  min,
  max,
  disabled,
  error,
  messages: overrides,
  className,
}: DateRangeInputProps) {
  const messages = { ...RANGE_MESSAGES, ...overrides };
  const [nativeInvalid, setNativeInvalid] = useState({
    from: false,
    to: false,
  });
  const problem =
    error ??
    (nativeInvalid.from || nativeInvalid.to
      ? messages.invalid
      : dateRangeError(value, min, max, messages));
  const id = useId();
  const latestStart = [value.to, max].filter(Boolean).sort()[0];
  const earliestEnd = [value.from, min].filter(Boolean).sort().slice(-1)[0];
  return (
    <FieldGroup
      legend={label}
      disabled={disabled}
      className={className}
      aria-describedby={problem ? `${id}-error` : undefined}
    >
      <div className="grid gap-inline mobile:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-from`}>
            {label} {messages.from}
          </Label>
          <Input
            id={`${id}-from`}
            type="date"
            value={value.from}
            onInput={(event) => {
              const bad = event.currentTarget.validity.badInput;
              setNativeInvalid((current) => ({ ...current, from: bad }));
            }}
            onBlur={(event) => {
              const bad = event.currentTarget.validity.badInput;
              setNativeInvalid((current) => ({ ...current, from: bad }));
            }}
            min={min}
            max={latestStart}
            aria-invalid={Boolean(problem) || undefined}
            aria-describedby={problem ? `${id}-error` : undefined}
            onChange={(event) =>
              onChange({ ...value, from: event.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-to`}>
            {label} {messages.to}
          </Label>
          <Input
            id={`${id}-to`}
            type="date"
            value={value.to}
            onInput={(event) => {
              const bad = event.currentTarget.validity.badInput;
              setNativeInvalid((current) => ({ ...current, to: bad }));
            }}
            onBlur={(event) => {
              const bad = event.currentTarget.validity.badInput;
              setNativeInvalid((current) => ({ ...current, to: bad }));
            }}
            min={earliestEnd}
            max={max}
            aria-invalid={Boolean(problem) || undefined}
            aria-describedby={problem ? `${id}-error` : undefined}
            onChange={(event) => onChange({ ...value, to: event.target.value })}
          />
        </div>
      </div>
      {problem && (
        <Text id={`${id}-error`} size="sm" variant="destructive" role="alert">
          {problem}
        </Text>
      )}
    </FieldGroup>
  );
}

export type TimeInputProps = Omit<DateInputProps, 'value'> & {
  /** A wall-clock time HH:mm, without a date or timezone conversion. */
  value: string;
  /** Native time input step, in seconds. */
  step?: number;
};

export function TimeInput({
  label,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  error,
  hint,
  requiredLabel,
  step = 60,
  className,
}: TimeInputProps) {
  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      required={required}
      requiredLabel={requiredLabel}
      className={className}
    >
      {(control) => (
        <Input
          {...control}
          type="time"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="tabular-nums"
        />
      )}
    </FormField>
  );
}

export type DateTimeResolution =
  | { status: 'valid'; instant: string; offset: string }
  | { status: 'empty' | 'invalid' | 'gap' }
  | { status: 'ambiguous'; earlier: string; later: string };
export type DateTimeDisambiguation = 'earlier' | 'later';

/** Resolve an IANA-zone wall time; never silently shift a gap or choose a repeated hour. */
export function resolveDateTime(
  value: string,
  timeZone: string,
  disambiguation?: DateTimeDisambiguation,
): DateTimeResolution {
  if (!value) return { status: 'empty' };
  try {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value))
      return { status: 'invalid' };
    const plain = Temporal.PlainDateTime.from(value, { overflow: 'reject' });
    const earlier = plain.toZonedDateTime(timeZone, {
      disambiguation: 'earlier',
    });
    const later = plain.toZonedDateTime(timeZone, { disambiguation: 'later' });
    if (
      !earlier.toPlainDateTime().equals(plain) ||
      !later.toPlainDateTime().equals(plain)
    )
      return { status: 'gap' };
    if (
      earlier.epochMilliseconds !== later.epochMilliseconds &&
      !disambiguation
    ) {
      return {
        status: 'ambiguous',
        earlier: earlier.offset,
        later: later.offset,
      };
    }
    const chosen = disambiguation === 'later' ? later : earlier;
    return {
      status: 'valid',
      instant: chosen.toInstant().toString(),
      offset: chosen.offset,
    };
  } catch {
    return { status: 'invalid' };
  }
}

export type DateTimeMessages = {
  zone: (timeZone: string) => string;
  invalid: string;
  gap: string;
  ambiguous: string;
  occurrence: string;
  choose: string;
  earlier: (offset: string) => string;
  later: (offset: string) => string;
  beforeMin: (min: string) => string;
  afterMax: (max: string) => string;
};
const DATETIME_MESSAGES: DateTimeMessages = {
  zone: (zone) => `Time zone: ${zone}`,
  invalid: 'Enter a valid date, time and time zone.',
  gap: 'This time does not exist because the clocks move forward. Choose another time.',
  ambiguous: 'This time occurs twice. Choose which occurrence to use.',
  occurrence: 'Occurrence',
  choose: 'Choose an occurrence',
  earlier: (offset) => `First occurrence (${offset})`,
  later: (offset) => `Second occurrence (${offset})`,
  beforeMin: (min) => `Choose a date and time on or after ${min}.`,
  afterMax: (max) => `Choose a date and time on or before ${max}.`,
};
export type DateTimeFieldProps = DateInputProps & {
  /** IANA timezone, e.g. Europe/Stockholm. The value stays a wall-clock datetime. */
  timeZone: string;
  /** Explicit choice for a repeated hour. Clear this when value or timeZone changes. */
  disambiguation?: DateTimeDisambiguation;
  onDisambiguationChange?: (value: DateTimeDisambiguation | undefined) => void;
  messages?: Partial<DateTimeMessages>;
};

/** Call resolveDateTime before saving; only its valid result contains a storable instant. */
export function DateTimeField({
  timeZone,
  disambiguation,
  onDisambiguationChange,
  messages: overrides,
  label,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  error,
  hint,
  requiredLabel,
  className,
}: DateTimeFieldProps) {
  const messages = { ...DATETIME_MESSAGES, ...overrides };
  const [badInput, setBadInput] = useState(false);
  const resolution = resolveDateTime(value, timeZone, disambiguation);
  const repeated = resolveDateTime(value, timeZone);
  const problem =
    error ??
    (badInput || resolution.status === 'invalid'
      ? messages.invalid
      : resolution.status === 'gap'
        ? messages.gap
        : resolution.status === 'ambiguous'
          ? messages.ambiguous
          : value && min && value < min
            ? messages.beforeMin(min)
            : value && max && value > max
              ? messages.afterMax(max)
              : undefined);
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-inline', className)}>
      <FormField
        label={label}
        hint={
          <>
            {messages.zone(timeZone)}
            {hint && <> · {hint}</>}
          </>
        }
        error={problem}
        required={required}
        requiredLabel={requiredLabel}
      >
        {(control) => (
          <Input
            {...control}
            type="datetime-local"
            onInput={(event) =>
              setBadInput(event.currentTarget.validity.badInput)
            }
            onBlur={(event) =>
              setBadInput(event.currentTarget.validity.badInput)
            }
            value={value}
            min={min}
            max={max}
            disabled={disabled}
            onChange={(event) => {
              onDisambiguationChange?.(undefined);
              onChange(event.target.value);
            }}
            className="tabular-nums"
          />
        )}
      </FormField>
      {repeated.status === 'ambiguous' && onDisambiguationChange && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id}>{messages.occurrence}</Label>
          <Select
            value={disambiguation ?? ''}
            disabled={disabled}
            required
            onValueChange={(value) =>
              onDisambiguationChange(
                value as DateTimeDisambiguation,
              )
            }
          >
            <SelectTrigger id={id} aria-invalid={resolution.status === 'ambiguous' || undefined}>
              <SelectValue placeholder={messages.choose} />
            </SelectTrigger>
            <SelectContent aria-label={messages.occurrence}>
              <SelectItem value="earlier">{messages.earlier(repeated.earlier)}</SelectItem>
              <SelectItem value="later">{messages.later(repeated.later)}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
