import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { FieldGroup } from './form-field';
import { Text } from './text';

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}
export interface RadioGroupProps {
  label: ReactNode;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly RadioOption[];
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  requiredLabel?: string;
  disabled?: boolean;
  className?: string;
  optionClassName?: string;
}

export function RadioGroup({
  label,
  name,
  value,
  onValueChange,
  options,
  description,
  error,
  required = false,
  requiredLabel = 'required',
  disabled,
  className,
  optionClassName,
}: RadioGroupProps) {
  const id = useId();
  return (
    <FieldGroup
      legend={
        <>
          {label}
          {required && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({requiredLabel})
            </span>
          )}
        </>
      }
      description={description}
      disabled={disabled}
      className={className}
    >
      <div className="grid gap-inline">
        {options.map((option, index) => (
          <label
            key={option.value}
            className={cn(
              'flex min-h-9 cursor-pointer items-start gap-inline rounded-md p-inline has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
              optionClassName,
            )}
          >
            <input
              type="radio"
              name={name ?? id}
              value={option.value}
              checked={value === option.value}
              disabled={disabled === true || option.disabled === true}
              required={required}
              aria-labelledby={`${id}-${index}-label`}
              aria-invalid={error ? true : undefined}
              aria-describedby={
                [
                  option.description ? `${id}-${index}-description` : undefined,
                  error ? `${id}-error` : undefined,
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              onChange={() => onValueChange(option.value)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="flex min-w-0 flex-col gap-1">
              <span id={`${id}-${index}-label`} className="text-sm font-medium">
                {option.label}
              </span>
              {option.description && (
                <Text
                  as="span"
                  id={`${id}-${index}-description`}
                  size="sm"
                  variant="muted"
                >
                  {option.description}
                </Text>
              )}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <Text id={`${id}-error`} size="sm" variant="destructive">
          {error}
        </Text>
      )}
    </FieldGroup>
  );
}

export function ChoiceCards(props: RadioGroupProps) {
  return (
    <RadioGroup
      {...props}
      optionClassName={cn(
        'border border-input bg-background p-inset has-[:checked]:border-primary has-[:checked]:bg-accent',
        props.optionClassName,
      )}
    />
  );
}
