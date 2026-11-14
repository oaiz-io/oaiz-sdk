import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Text } from './text';

interface SegmentedControlProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly {
    value: string;
    label: string;
    icon?: ReactNode;
    disabled?: boolean;
  }[];
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl({
  label,
  value,
  onValueChange,
  options,
  disabled = false,
  className,
}: SegmentedControlProps) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex h-9 shrink-0 overflow-hidden rounded-md border border-input bg-background',
        className,
      )}
    >
      {options.map((option) => (
        <label
          key={option.value}
          title={option.label}
          className="relative flex border-l border-input first:border-l-0"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            aria-label={option.label}
            checked={value === option.value}
            disabled={disabled || (option.disabled ?? false)}
            onChange={() => onValueChange(option.value)}
            className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
          {/* The selected option takes the app's selection surface and full
              ink; the others stay muted, so the choice reads without colour. */}
          <span className="inline-flex h-full min-w-16 cursor-pointer items-center justify-center gap-inline px-inset text-muted-foreground transition-colors duration-fast ease-move hover:bg-accent hover:text-foreground peer-checked:bg-surface-hover peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-ring peer-disabled:pointer-events-none peer-disabled:opacity-50">
            {option.icon ? (
              <span aria-hidden className="flex [&_svg]:size-4">
                {option.icon}
              </span>
            ) : (
              <Text as="span" size="sm" weight="medium">
                {option.label}
              </Text>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
