import { Label } from './ui/label';
import { Button } from './ui/button';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { cn } from '../lib/utils';
import { Alert, AlertDescription } from './ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Heading } from './ui/heading';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Skeleton } from './ui/skeleton';
import { Text } from './ui/text';
import { Textarea } from './ui/textarea';

export type RecordDetailField<Row> = {
  /** The column the field shows and saves. */
  key: string;
  label: string;
  /** Shown before the label, such as an icon for the field's type. */
  icon?: ReactNode;
  type: 'text' | 'number' | 'email' | 'textarea' | 'select';
  options?: { value: string; label: ReactNode }[];
  /** How the value reads when it is not being edited; the raw value when omitted. */
  display?: (row: Row) => ReactNode;
  readOnly?: boolean;
};

export type RecordDetailProps<Row> = {
  title: ReactNode;
  subtitle?: ReactNode;
  fields: RecordDetailField<Row>[];
  row: Row | undefined;
  loading?: boolean;
  /** Shown instead of the fields. */
  error?: { message: string } | null;
  /** Saves one field; the field shows the rejection's message and keeps the entered value. */
  onSave?: (column: string, value: string | number | null) => Promise<unknown>;
  /** Buttons beside the title. */
  actions?: ReactNode;
  /** Related records below the fields, such as a customer's orders. */
  children?: ReactNode;
  labels?: Partial<RecordDetailLabels>;
};

export type RecordDetailLabels = {
  empty: string;
  details: string;
  description: string;
  saveError: string;
  numberError: string;
  close: string;
};
const defaultLabels: RecordDetailLabels = {
  empty: 'Empty',
  details: 'Details',
  description: 'Record details',
  saveError: 'The change was not saved.',
  numberError: 'Enter a number.',
  close: 'Close',
};

function valueOf<Row>(row: Row, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

function asText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function Field<Row>({
  field,
  row,
  onSave,
  labels,
}: {
  field: RecordDetailField<Row>;
  row: Row;
  onSave?: RecordDetailProps<Row>['onSave'];
  labels: RecordDetailLabels;
}) {
  const id = useId();
  const current = valueOf(row, field.key);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Enter saves and the blur that follows must not save again.
  const inFlight = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const cancelled = useRef(false);
  useLayoutEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false;
      trigger.current?.focus();
    }
  }, [editing]);
  const editable = onSave !== undefined && !field.readOnly;

  async function save(text: string, restore = false, badInput = false) {
    if (inFlight.current || cancelled.current) return;
    if (badInput) {
      setError(labels.numberError);
      return;
    }
    restoreFocus.current = restore;
    const value =
      text.trim() === '' ? null : field.type === 'number' ? Number(text) : text;
    if (value === current || (value === null && current == null)) {
      setEditing(false);
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave!(field.key, value);
      setEditing(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : labels.saveError);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function onKeyDown(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelled.current = true;
      restoreFocus.current = true;
      setEditing(false);
      setError(null);
    } else if (
      event.key === 'Enter' &&
      (field.type !== 'textarea' || event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault();
      void save(draft, true, event.currentTarget.validity.badInput);
    }
  }

  const shown = field.display ? field.display(row) : asText(current);
  const empty = current === null || current === undefined || current === '';

  let control: ReactNode;
  if (field.type === 'select' && editable) {
    control = (
      <Select
        value={asText(current) || undefined}
        disabled={saving}
        onValueChange={(chosen) => void save(chosen)}
      >
        <SelectTrigger id={id} size="sm" className="w-full">
          <SelectValue placeholder={labels.empty} />
        </SelectTrigger>
        <SelectContent aria-labelledby={`${id}-label`}>
          {field.options?.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  } else if (editing) {
    const shared = {
      id,
      autoFocus: true,
      value: draft,
      disabled: saving,
      'aria-invalid': error !== null,
      'aria-describedby': error ? `${id}-error` : undefined,
      onChange: (event: { target: { value: string } }) => {
        setDraft(event.target.value);
        setError(null);
      },
      onKeyDown,
      onBlur: (event: { currentTarget: { validity: ValidityState } }) =>
        void save(draft, false, event.currentTarget.validity.badInput),
    };
    control =
      field.type === 'textarea' ? (
        <Textarea {...shared} rows={3} />
      ) : (
        <Input
          {...shared}
          type={field.type === 'select' ? 'text' : field.type}
        />
      );
  } else if (editable) {
    control = (
      <Button variant="plain" size={null}
        ref={trigger}
        id={id}
        type="button"
        aria-labelledby={`${id}-label ${id}-value`}
        className={cn(
          'flex min-h-8 w-full items-center rounded-md px-inline text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          empty && 'text-muted-foreground',
        )}
        onClick={() => {
          cancelled.current = false;
          setDraft(asText(current));
          setEditing(true);
        }}
      >
        <span id={`${id}-value`}>{empty ? labels.empty : shown}</span>
      </Button>
    );
  } else {
    control = (
      <Text
        as="div"
        id={id}
        size="sm"
        className={cn('px-inline py-1.5', empty && 'text-muted-foreground')}
      >
        {empty ? labels.empty : shown}
      </Text>
    );
  }

  return (
    <div className="grid grid-cols-[9rem_1fr] items-start gap-inline">
      <Label
        id={`${id}-label`}
        htmlFor={id}
        className="flex min-h-8 items-center gap-1.5 text-sm text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0"
      >
        {field.icon && (
          <span aria-hidden="true" className="flex">
            {field.icon}
          </span>
        )}
        <span className="truncate">{field.label}</span>
      </Label>
      <div className="flex min-w-0 flex-col gap-1">
        {control}
        {error && (
          <Text id={`${id}-error`} size="sm" variant="destructive" role="alert">
            {error}
          </Text>
        )}
      </div>
    </div>
  );
}

function RecordFields<Row>({
  fields,
  row,
  loading,
  onSave,
  labels,
}: Pick<RecordDetailProps<Row>, 'fields' | 'row' | 'onSave'> & {
  loading: boolean;
  labels: RecordDetailLabels;
}) {
  return (
    <section aria-label={labels.details} className="flex flex-col gap-1">
      {loading || row === undefined
        ? fields.map((field) => (
            <div
              key={field.key}
              className="grid grid-cols-[9rem_1fr] gap-inline py-2"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))
        : fields.map((field) => (
            <Field
              key={field.key}
              field={field}
              row={row}
              onSave={onSave}
              labels={labels}
            />
          ))}
    </section>
  );
}

/**
 * One record: a title, its fields with inline editing, and related records below. A text field
 * opens on click and saves on Enter or when it loses focus; Escape cancels. A select saves when
 * an option is chosen.
 */
export function RecordDetail<Row>({
  title,
  subtitle,
  fields,
  row,
  loading = false,
  error,
  onSave,
  actions,
  children,
  labels: suppliedLabels,
}: RecordDetailProps<Row>) {
  const labels = { ...defaultLabels, ...suppliedLabels };
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <article aria-busy={loading} className="flex flex-col gap-section">
      <header className="flex items-start justify-between gap-stack">
        <div className="flex min-w-0 flex-col gap-1">
          {loading || row === undefined ? (
            <Skeleton className="h-7 w-48" />
          ) : (
            <Heading level={2} size="2xl" className="truncate">
              {title}
            </Heading>
          )}
          {subtitle && !loading && <Text variant="muted">{subtitle}</Text>}
        </div>
        {actions && <div className="flex shrink-0 gap-inline">{actions}</div>}
      </header>
      <RecordFields
        fields={fields}
        row={row}
        loading={loading}
        onSave={onSave}
        labels={labels}
      />
      {children}
    </article>
  );
}

export type RecordDetailDialogProps<Row> = RecordDetailProps<Row> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** `RecordDetail` in a dialog, whose title is the record's: nothing repeats it. */
export function RecordDetailDialog<Row>({
  open,
  onOpenChange,
  title,
  subtitle,
  fields,
  row,
  loading = false,
  error,
  onSave,
  actions,
  children,
  labels: suppliedLabels,
}: RecordDetailDialogProps<Row>) {
  const labels = { ...defaultLabels, ...suppliedLabels };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle className="truncate pr-section">{title}</DialogTitle>
          {subtitle ? (
            <DialogDescription>{subtitle}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">
              {labels.description}
            </DialogDescription>
          )}
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : (
          <div aria-busy={loading} className="flex flex-col gap-section">
            <RecordFields
              fields={fields}
              row={row}
              loading={loading}
              onSave={onSave}
              labels={labels}
            />
            {children}
            {actions && (
              <div className="flex justify-end gap-inline">{actions}</div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
