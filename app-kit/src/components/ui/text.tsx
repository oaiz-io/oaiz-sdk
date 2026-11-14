/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

export type TextTag = 'p' | 'span' | 'div' | 'label' | 'small';

const textVariants = cva('font-sans text-foreground font-normal', {
  variants: {
    size: {
      '2xl': 'text-2xl leading-8',
      lg: 'text-lg leading-7',
      md: 'text-base leading-6',
      sm: 'text-sm leading-5',
      xs: 'text-xs leading-4',
      '2xs': 'text-2xs',
      caption: 'text-xs leading-4',
    },
    variant: {
      default: 'text-foreground',
      inherit: 'text-inherit',
      muted: 'text-muted-foreground',
      destructive: 'text-destructive-text',
      primary: 'text-primary',
      success: 'text-success-text',
      warning: 'text-warning-text',
      info: 'text-info-text',
      inverse: 'text-primary-foreground',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    leading: {
      none: 'leading-none',
      tight: 'leading-tight',
      normal: 'leading-normal',
      relaxed: 'leading-relaxed',
    },
  },
  defaultVariants: {
    size: 'sm',
    variant: 'default',
    weight: 'normal',
  },
});

export interface TextProps
  extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof textVariants> {
  asChild?: boolean;
  as?: TextTag;
}

const Text = React.forwardRef<HTMLElement, TextProps>(
  (
    {
      className,
      size,
      variant,
      weight,
      leading,
      asChild = false,
      as = 'p',
      ...props
    },
    ref,
  ) => {
    const Comp = (asChild ? Slot : as) as React.ElementType;

    return (
      <Comp
        ref={ref}
        className={cn(
          textVariants({
            size,
            variant,
            weight,
            leading,
          }),
          className,
        )}
        {...props}
      />
    );
  },
);
Text.displayName = 'Text';

export { Text, textVariants };
