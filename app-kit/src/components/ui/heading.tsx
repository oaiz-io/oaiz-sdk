/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingTag =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'span'
  | 'div';

const LEVEL_DEFAULT_TAG: Record<HeadingLevel, HeadingTag> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
};

const headingVariants = cva('font-sans text-foreground', {
  variants: {
    size: {
      '5xl': 'text-4xl tracking-tight half:text-5xl',
      '3xl': 'text-3xl tracking-tight',
      '2xl': 'text-2xl tracking-tight',
      lg: 'text-lg tracking-normal',
      md: 'text-base',
      sm: 'text-sm',
      xs: 'text-xs tracking-wider',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    variant: {
      default: 'text-foreground',
      inherit: 'text-inherit',
      muted: 'text-muted-foreground',
      destructive: 'text-destructive-text',
      primary: 'text-primary',
    },
  },
  defaultVariants: {
    size: '2xl',
    weight: 'semibold',
    variant: 'default',
  },
});

const LEVEL_DEFAULT_SIZE: Record<
  HeadingLevel,
  NonNullable<VariantProps<typeof headingVariants>['size']>
> = {
  1: '3xl',
  2: '2xl',
  3: 'lg',
  4: 'md',
  5: 'sm',
  6: 'xs',
};

const LEVEL_DEFAULT_WEIGHT: Record<
  HeadingLevel,
  NonNullable<VariantProps<typeof headingVariants>['weight']>
> = {
  1: 'normal',
  2: 'semibold',
  3: 'semibold',
  4: 'semibold',
  5: 'semibold',
  6: 'semibold',
};

export interface HeadingProps
  extends
    React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  asChild?: boolean;
  as?: HeadingTag;
  level?: HeadingLevel;
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  (
    { className, size, weight, variant, asChild = false, as, level, ...props },
    ref,
  ) => {
    const resolvedLevel =
      level ??
      (as && /^h[1-6]$/.test(as) ? (Number(as.slice(1)) as HeadingLevel) : 2);

    const resolvedTag = as ?? LEVEL_DEFAULT_TAG[resolvedLevel];
    const resolvedSize = size ?? LEVEL_DEFAULT_SIZE[resolvedLevel];
    const resolvedWeight = weight ?? LEVEL_DEFAULT_WEIGHT[resolvedLevel];

    const Comp = (asChild ? Slot : resolvedTag) as React.ElementType;

    return (
      <Comp
        ref={ref}
        className={cn(
          headingVariants({
            size: resolvedSize,
            weight: resolvedWeight,
            variant,
          }),
          className,
        )}
        {...props}
      />
    );
  },
);
Heading.displayName = 'Heading';

export { Heading, headingVariants };
