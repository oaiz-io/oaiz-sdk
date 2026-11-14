/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const inputVariants = cva(
  'flex h-10 w-full rounded-md px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 half:text-sm transition-colors duration-fast ease-move aria-invalid:border-destructive-text aria-invalid:focus-visible:ring-destructive-text',
  {
    variants: {
      variant: {
        default:
          'border border-input bg-background focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1',
        filled:
          'border border-transparent bg-input-fill text-foreground hover:bg-input-fill-hover focus-visible:border-input focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:hover:bg-input-fill aria-invalid:border-destructive-text aria-invalid:focus-visible:border-destructive-text',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface InputProps
  extends React.ComponentProps<'input'>, VariantProps<typeof inputVariants> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, variant, type, error, 'aria-invalid': ariaInvalid, ...props },
    ref,
  ) => {
    const isInvalid =
      error === true || ariaInvalid === true || ariaInvalid === 'true';

    return (
      <input
        type={type}
        aria-invalid={isInvalid ? true : ariaInvalid}
        className={cn(inputVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input, inputVariants };
