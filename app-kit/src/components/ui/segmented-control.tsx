import { useId, type CSSProperties, type ReactNode } from 'react';
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
  variant?: 'default' | 'pill';
  className?: string;
}

export function SegmentedControl({
  label,
  value,
  onValueChange,
  options,
  disabled = false,
  variant = 'default',
  className,
}: SegmentedControlProps) {
  const name = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={
        variant === 'pill'
          ? ({
              '--segment-count': options.length,
              '--segment-index': selectedIndex,
            } as CSSProperties)
          : undefined
      }
      data-selection-visible={selectedIndex >= 0}
      className={cn(
        'inline-flex shrink-0',
        variant === 'pill'
          ? 'data-[selection-visible=false]:before:hidden relative isolate grid h-11 auto-cols-fr grid-flow-col gap-1 rounded-full bg-muted p-1 before:pointer-events-none before:absolute before:inset-y-1 before:left-1 before:w-[calc((100%-var(--spacing)*(var(--segment-count)+1))/var(--segment-count))] before:rounded-full before:bg-background before:shadow-sm before:translate-x-[calc(var(--segment-index)*(100%+var(--spacing)))] before:transition-transform before:duration-normal before:ease-move motion-reduce:before:transition-none'
          : 'h-9 overflow-hidden rounded-md border border-input bg-background',
        className,
      )}
    >
      {options.map((option) => (
        <label
          key={option.value}
          title={option.label}
          className={cn(
            'relative flex',
            variant === 'default' && 'border-l border-input first:border-l-0',
          )}
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
          <span
            className={cn(
              'inline-flex h-full min-w-16 cursor-pointer items-center justify-center gap-inline px-inset text-muted-foreground transition-colors duration-fast ease-move hover:bg-accent hover:text-foreground peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-ring peer-disabled:pointer-events-none peer-disabled:opacity-50',
              variant === 'pill'
                ? 'rounded-full peer-checked:bg-transparent'
                : 'peer-checked:bg-surface-hover',
            )}
          >
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
