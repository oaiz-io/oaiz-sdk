import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { ErrorSummary, FieldGroup, FormField } from './ui/form-field';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Textarea } from './ui/textarea';

export type RecordField = {
  name: string;
  label: ReactNode;
  type: 'text' | 'number' | 'email' | 'date' | 'textarea' | 'select';
  required?: boolean;
  decimals?: number;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: ReactNode;
  autoComplete?: string;
};
export type RecordValues = Record<string, string | number>;
export type RecordFormLabels = {
  required: string;
  choose: string;
  saving: string;
  summary: string;
  requiredError: string;
  emailError: string;
  numberError: string;
  dateError: string;
  decimalsError: (places: number) => string;
  saveError: string;
};
const defaults: RecordFormLabels = {
  required: 'required',
  choose: 'Choose',
  saving: 'Saving…',
  summary: 'Check the following fields',
  requiredError: 'This field is required.',
  emailError: 'Enter a valid email address.',
  numberError: 'Enter a number.',
  dateError: 'Enter a valid calendar date.',
  decimalsError: (places) => `Use no more than ${places} decimal places.`,
  saveError: 'The changes were not saved. Try again.',
};
export type RecordFormProps = {
  fields: RecordField[];
  submitLabel: ReactNode;
  onSubmit: (values: RecordValues) => unknown;
  validate?: (values: RecordValues) => Record<string, string> | undefined;
  pending?: boolean;
  error?: { message: string } | null;
  /** Initial values are read on mount; key the form by record ID when changing records. */
  initialValues?: RecordValues;
  /** Edit forms preserve their values after saving; create forms reset by default. */
  mode?: 'create' | 'edit';
  resetOnSuccess?: boolean;
  legend?: ReactNode;
  labels?: Partial<RecordFormLabels>;
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function builtInError(
  field: RecordField,
  value: string,
  labels: RecordFormLabels,
  badInput = false,
): string | undefined {
  if (badInput)
    return field.type === 'date' ? labels.dateError : labels.numberError;
  if (value === '') return field.required ? labels.requiredError : undefined;
  if (field.type === 'email' && !EMAIL.test(value)) return labels.emailError;
  if (field.type === 'number' && !Number.isFinite(Number(value)))
    return labels.numberError;
  if (
    field.type === 'number' &&
    field.decimals !== undefined &&
    (value.split('.')[1] ?? '').length > field.decimals
  )
    return labels.decimalsError(field.decimals);
  return undefined;
}

/** Empty create fields are omitted so database defaults apply; empty edit fields are explicit. */
export function RecordForm({
  fields,
  submitLabel,
  onSubmit,
  validate,
  pending = false,
  error,
  initialValues = {},
  mode = 'create',
  resetOnSuccess = mode === 'create',
  legend,
  labels: suppliedLabels,
}: RecordFormProps) {
  const labels = { ...defaults, ...suppliedLabels };
  const id = useId();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initialValues).map(([key, value]) => [key, String(value)]),
    ),
  );
  const initial = useRef(values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const summary = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const busy = pending || saving;
  useLayoutEffect(() => {
    if (attempt > 0) summary.current?.focus();
  }, [attempt]);

  function change(field: RecordField, value: string, badInput = false) {
    if (busy || inFlight.current) return;
    setValues((current) => ({ ...current, [field.name]: value }));
    setErrors((current) => {
      if (!current[field.name]) return current;
      const next = { ...current };
      const problem = builtInError(field, value.trim(), labels, badInput);
      if (problem) next[field.name] = problem;
      else delete next[field.name];
      return next;
    });
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || inFlight.current) return;
    const submitted: RecordValues = {};
    const found: Record<string, string> = {};
    for (const field of fields) {
      const value = (values[field.name] ?? '').trim();
      const control = inputRefs.current.get(field.name);
      const problem = builtInError(
        field,
        value,
        labels,
        control?.validity.badInput,
      );
      if (problem) found[field.name] = problem;
      else if (value !== '')
        submitted[field.name] = field.type === 'number' ? Number(value) : value;
      else if (mode === 'edit') submitted[field.name] = '';
    }
    const all =
      Object.keys(found).length > 0 ? found : (validate?.(submitted) ?? {});
    setErrors(all);
    if (Object.keys(all).length > 0) {
      setAttempt((value) => value + 1);
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setFailure(null);
    try {
      await onSubmit(submitted);
      if (resetOnSuccess) setValues(initial.current);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : labels.saveError);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  const controls = fields.map((field) => (
    <FormField
      key={field.name}
      id={`${id}-${field.name}`}
      label={field.label}
      hint={field.hint}
      error={errors[field.name]}
      required={field.required}
      requiredLabel={labels.required}
    >
      {(control) =>
        field.type === 'select' ? (
          <Select
            value={values[field.name] ?? ''}
            onValueChange={(value) => change(field, value)}
            required={field.required}
            disabled={busy}
          >
            <SelectTrigger
              {...control}
              data-testid={`record-form-${field.name}`}
            >
              <SelectValue placeholder={field.placeholder ?? labels.choose} />
            </SelectTrigger>
            <SelectContent aria-labelledby={`${control.id}-label`}>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.type === 'textarea' ? (
          <Textarea
            {...control}
            name={field.name}
            value={values[field.name] ?? ''}
            autoComplete={field.autoComplete}
            disabled={busy}
            placeholder={field.placeholder}
            onChange={(event) => change(field, event.target.value)}
            data-testid={`record-form-${field.name}`}
          />
        ) : (
          <Input
            {...control}
            ref={(input) => {
              if (input) inputRefs.current.set(field.name, input);
              else inputRefs.current.delete(field.name);
            }}
            name={field.name}
            value={values[field.name] ?? ''}
            type={field.type}
            step={field.type === 'number' ? 'any' : undefined}
            autoComplete={field.autoComplete}
            disabled={busy}
            placeholder={field.placeholder}
            onInput={(event) =>
              change(
                field,
                event.currentTarget.value,
                event.currentTarget.validity.badInput,
              )
            }
            onChange={(event) =>
              change(field, event.target.value, event.target.validity.badInput)
            }
            data-testid={`record-form-${field.name}`}
          />
        )
      }
    </FormField>
  ));
  return (
    <form
      noValidate
      aria-busy={busy}
      className="flex flex-col gap-stack"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <ErrorSummary
        ref={summary}
        title={labels.summary}
        errors={fields
          .filter((field) => errors[field.name])
          .map((field) => ({
            id: `${id}-${field.name}`,
            label: field.label,
            message: errors[field.name],
          }))}
      />
      {legend ? (
        <FieldGroup legend={legend} disabled={busy}>
          {controls}
        </FieldGroup>
      ) : (
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-stack">
          {controls}
        </fieldset>
      )}
      {(error || failure) && (
        <Alert variant="destructive">
          <AlertDescription>{error?.message ?? failure}</AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        disabled={busy}
        className="self-start"
        data-testid="record-form-submit"
      >
        {busy ? labels.saving : submitLabel}
      </Button>
    </form>
  );
}
