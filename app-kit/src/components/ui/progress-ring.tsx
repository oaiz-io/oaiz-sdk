import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';
import { Text } from './text';

const progressRingVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center',
  {
    variants: {
      size: {
        sm: 'size-10',
        md: 'size-16',
        lg: 'size-24',
      },
      tone: {
        default: 'text-primary',
        success: 'text-success',
        warning: 'text-warning',
        destructive: 'text-destructive',
      },
    },
    defaultVariants: { size: 'md', tone: 'default' },
  },
);

const VALUE_SIZE = { sm: '2xs', md: 'sm', lg: 'lg' } as const;
const STROKE = { sm: 4, md: 6, lg: 8 } as const;

export interface ProgressRingProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof progressRingVariants> {
  value: number;
  max?: number;
  /** What the ring measures, such as "Quarterly target"; it names the progress bar. */
  label: string;
  /** Writes the value in the middle; the percentage when omitted. */
  formatValue?: (value: number, max: number) => string;
  /** Leaves the middle empty, for a ring beside its own figure. */
  hideValue?: boolean;
}

/**
 * Progress towards a goal as a ring with the value in the middle: a target, a quota or how much
 * of a checklist is done. A change of value sweeps the ring; reduced motion shows it at once.
 */
const ProgressRing = React.forwardRef<HTMLDivElement, ProgressRingProps>(
  (
    {
      value,
      max = 100,
      label,
      formatValue,
      hideValue = false,
      size,
      tone,
      className,
      ...props
    },
    ref,
  ) => {
    const scale = size ?? 'md';
    const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
    const stroke = STROKE[scale];
    const radius = 50 - stroke / 2;
    const circumference = 2 * Math.PI * radius;
    const shown = formatValue
      ? formatValue(value, max)
      : `${Math.round(share * 100)}%`;
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={shown}
        className={cn(progressRingVariants({ size, tone }), className)}
        {...props}
      >
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - share)}
            className="transition-[stroke-dashoffset] duration-slow ease-move"
          />
        </svg>
        {!hideValue && (
          <Text
            as="span"
            size={VALUE_SIZE[scale]}
            weight="semibold"
            className="relative tabular-nums"
          >
            {shown}
          </Text>
        )}
      </div>
    );
  },
);
ProgressRing.displayName = 'ProgressRing';

export { ProgressRing, progressRingVariants };
