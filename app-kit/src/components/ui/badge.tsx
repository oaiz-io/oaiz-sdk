/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        compact: 'px-1.5 py-0.5 text-2xs',
      },
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-muted text-foreground hover:bg-muted/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground',
        // Status fills pair with their own foreground token and carry no hover
        // alpha: at 80% over the page the success pair falls below 4.5:1.
        success: 'border-transparent bg-success text-success-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
        info: 'border-transparent bg-info-bg text-info-text font-medium',
        'success-subtle':
          'border-transparent bg-badge-success text-badge-success-foreground font-medium',
        'warning-subtle':
          'border-transparent bg-badge-warning text-badge-warning-foreground font-medium',
        'destructive-subtle':
          'border-transparent bg-destructive-bg-subtle text-destructive-text font-medium',
        neutral:
          'border-transparent bg-badge-neutral text-badge-neutral-foreground font-medium',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
