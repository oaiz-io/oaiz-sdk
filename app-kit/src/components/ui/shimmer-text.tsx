/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

export type ShimmerTextTag =
  | 'span'
  | 'p'
  | 'div'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6';

const shimmerTextVariants = cva('oaiz-shimmer-text inline-block text-primary', {
  variants: {
    appearance: {
      default: '',
      activity: 'oaiz-shimmer-text--activity',
      rainbow: 'oaiz-shimmer-text--rainbow',
    },
    size: {
      inherit: '',
      xs: 'text-xs leading-4',
      sm: 'text-sm leading-5',
      md: 'text-base leading-6',
      lg: 'text-lg leading-7',
    },
    speed: {
      normal: 'animate-[oaiz-text-shimmer_2s_linear_infinite]',
      fast: 'animate-[oaiz-text-shimmer_1.2s_linear_infinite]',
      slow: 'animate-[oaiz-text-shimmer_3s_linear_infinite]',
    },
  },
  defaultVariants: {
    appearance: 'default',
    size: 'inherit',
    speed: 'normal',
  },
});

export interface ShimmerTextProps
  extends
    React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof shimmerTextVariants> {
  asChild?: boolean;
  as?: ShimmerTextTag;
  children: React.ReactNode;
}

const ShimmerText = React.forwardRef<HTMLElement, ShimmerTextProps>(
  (
    {
      className,
      appearance,
      size,
      speed,
      asChild = false,
      as = 'span',
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = (asChild ? Slot : as) as React.ElementType;

    return (
      <Comp
        ref={ref}
        className={cn(
          shimmerTextVariants({ appearance, size, speed }),
          className,
        )}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);
ShimmerText.displayName = 'ShimmerText';

export { ShimmerText, shimmerTextVariants };
