/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-inline whitespace-nowrap text-sm font-medium outline-none ring-offset-background transition-[color,background-color,border-color,outline-color,box-shadow,transform,translate,scale,rotate] duration-fast ease-move active:scale-[0.98] focus-visible:outline-none focus-visible:not-data-[pointer-close-focus]:ring-2 focus-visible:not-data-[pointer-close-focus]:ring-ring focus-visible:not-data-[pointer-close-focus]:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-input bg-background hover:bg-accent text-foreground hover:text-foreground',
        secondary: 'bg-muted text-foreground hover:bg-muted/80',
        info: 'bg-info-solid text-info-solid-foreground hover:bg-info-solid-hover',
        brand: 'bg-logo-yellow text-brand-foreground hover:bg-logo-yellow/90',
        success: 'bg-success text-success-foreground hover:bg-success-hover',
        ghost: 'hover:bg-accent hover:text-foreground',
        plain: 'bg-transparent',
        filled:
          'border border-transparent bg-input-fill text-muted-foreground font-normal hover:bg-input-fill-hover focus-visible:not-data-[pointer-close-focus]:border-input focus-visible:not-data-[pointer-close-focus]:bg-background disabled:border-transparent disabled:bg-input-fill disabled:hover:bg-input-fill aria-invalid:border-destructive-text aria-invalid:focus-visible:border-destructive-text',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      shape: {
        default: 'rounded-md',
        pill: 'rounded-full',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        xs: 'h-7 px-3 text-xs [&_svg]:size-3.5',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
        'icon-xs': 'h-6 w-6 [&_svg]:size-3.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      shape: 'default',
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, shape, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
