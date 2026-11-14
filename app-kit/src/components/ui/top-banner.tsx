/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button, type ButtonProps } from './button';
import { Separator } from './separator';
import { Text } from './text';

const topBannerVariants = cva(
  'grid w-full min-w-0 shrink-0 items-center gap-inline border-b px-inline [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      layout: {
        compact: 'h-8 grid-cols-[1fr_minmax(0,auto)_1fr] whitespace-nowrap',
        wrap: 'min-h-8 grid-cols-[minmax(0,1fr)_auto] py-1',
      },
      tone: {
        muted: 'border-border bg-muted',
        warning: 'border-warning-text/30 bg-warning-bg-subtle',
      },
    },
    defaultVariants: {
      layout: 'compact',
      tone: 'muted',
    },
  },
);

export interface TopBannerProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof topBannerVariants> {
  /** Controls aligned to the end of the banner, such as `TopBannerDismiss`. */
  actions?: React.ReactNode;
}

/** Full-width strip above the app shell for environment or status notices. */
const TopBanner = React.forwardRef<HTMLDivElement, TopBannerProps>(
  (
    { className, tone, layout = 'compact', actions, children, ...props },
    ref,
  ) => (
    <Text
      as="div"
      size="xs"
      ref={ref}
      className={cn(topBannerVariants({ tone, layout }), className)}
      {...props}
    >
      <div
        className={cn(
          'flex min-w-0 items-center justify-center gap-inline',
          layout === 'compact'
            ? 'col-start-2'
            : 'flex-wrap [overflow-wrap:anywhere]',
        )}
      >
        {children}
      </div>
      {actions ? (
        <div
          className={cn(
            'flex items-center justify-end gap-inline [&>*]:shrink-0',
            layout === 'compact'
              ? 'col-start-3'
              : 'col-start-2 min-w-0 flex-wrap',
          )}
        >
          {actions}
        </div>
      ) : null}
    </Text>
  ),
);
TopBanner.displayName = 'TopBanner';

export type TopBannerDismissProps = Omit<
  ButtonProps,
  'variant' | 'size' | 'children' | 'asChild'
> & { 'aria-label': string };

const TopBannerDismiss = React.forwardRef<
  HTMLButtonElement,
  TopBannerDismissProps
>((props, ref) => (
  <Button ref={ref} variant="ghost" size="icon-xs" {...props}>
    <X aria-hidden="true" />
  </Button>
));
TopBannerDismiss.displayName = 'TopBannerDismiss';

/** Vertical rule between banner segments, sized to the banner's icons. */
const TopBannerSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  Omit<React.ComponentPropsWithoutRef<typeof Separator>, 'orientation'>
>(({ className, ...props }, ref) => (
  <Separator
    ref={ref}
    orientation="vertical"
    className={cn('h-3.5', className)}
    {...props}
  />
));
TopBannerSeparator.displayName = 'TopBannerSeparator';

export { TopBanner, TopBannerDismiss, TopBannerSeparator, topBannerVariants };
