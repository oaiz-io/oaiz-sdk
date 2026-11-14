import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Label } from './label';
import { Text } from './text';

export interface FieldControlProps {
  id: string;
  required: boolean;
  'aria-required': boolean;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

export interface FormFieldProps {
  id?: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  requiredLabel?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** The render prop associates a native input or a custom control with its visible feedback. */
export function FormField({
  id: suppliedId,
  label,
  hint,
  error,
  required = false,
  requiredLabel = 'required',
  className,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const descriptions = [
    hint ? `${id}-hint` : undefined,
    error ? `${id}-error` : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cn('flex min-w-0 flex-col gap-inline', className)}>
      <div className="flex items-baseline gap-1">
        <Label id={`${id}-label`} htmlFor={id}>
          {label}
        </Label>
        {required && (
          <span className="text-xs text-muted-foreground">
            ({requiredLabel})
          </span>
        )}
      </div>
      {hint && (
        <Text id={`${id}-hint`} size="sm" variant="muted">
          {hint}
        </Text>
      )}
      {children({
        id,
        required,
        'aria-required': required,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': descriptions || undefined,
      })}
      {error && (
        <Text id={`${id}-error`} size="sm" variant="destructive">
          {error}
        </Text>
      )}
    </div>
  );
}

export interface FieldGroupProps extends ComponentProps<'fieldset'> {
  legend: ReactNode;
  description?: ReactNode;
}

export function FieldGroup({
  legend,
  description,
  className,
  children,
  ...props
}: FieldGroupProps) {
  const id = useId();
  return (
    <fieldset
      className={cn('flex min-w-0 flex-col gap-stack', className)}
      aria-describedby={description ? id : undefined}
      {...props}
    >
      <legend className="mb-inline text-sm font-medium">{legend}</legend>
      {description && (
        <Text id={id} size="sm" variant="muted">
          {description}
        </Text>
      )}
      {children}
    </fieldset>
  );
}

export interface ErrorSummaryProps extends Omit<
  ComponentProps<'div'>,
  'title'
> {
  title?: ReactNode;
  errors: readonly { id: string; label: ReactNode; message: ReactNode }[];
}

/** Focus this summary after a failed submit; each link takes focus to its field. */
export function ErrorSummary({
  title = 'Check the following fields',
  errors,
  className,
  ...props
}: ErrorSummaryProps) {
  const titleId = useId();
  if (errors.length === 0) return null;
  return (
    <div
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cn(
        'rounded-md border border-destructive-text p-inset focus:outline-none focus:ring-2 focus:ring-ring',
        className,
      )}
      {...props}
    >
      <p id={titleId} className="font-medium">
        {title}
      </p>
      <ul className="mt-inline list-inside list-disc space-y-1">
        {errors.map((error) => (
          <li key={error.id}>
            <a
              href={`#${error.id}`}
              className="text-sm underline underline-offset-2"
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(error.id)?.focus();
              }}
            >
              {error.label}: {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
