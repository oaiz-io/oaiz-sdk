import * as React from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';

import { cn } from '../../lib/utils';
import { Text } from './text';

export interface BottomNavigationProps extends React.HTMLAttributes<HTMLElement> {
  'aria-label': string;
}

const BottomNavigation = React.forwardRef<HTMLElement, BottomNavigationProps>(
  ({ className, ...props }, ref) => (
    <nav
      ref={ref}
      className={cn(
        'flex min-h-[var(--mobile-nav-height)] w-full items-stretch border-t border-border bg-background',
        className,
      )}
      {...props}
    />
  ),
);
BottomNavigation.displayName = 'BottomNavigation';

export interface BottomNavigationItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: React.ReactNode;
  badge?: React.ReactNode;
  selected?: boolean;
  /** Compose an empty link as the interactive root; label supplies its content. */
  asChild?: boolean;
}

const BottomNavigationItem = React.forwardRef<
  HTMLButtonElement,
  BottomNavigationItemProps
>(
  (
    {
      className,
      icon,
      label,
      badge,
      selected = false,
      asChild = false,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    const content = (
      <>
        <span className="flex min-h-5 w-full flex-wrap items-center justify-center gap-1">
          <span aria-hidden="true" className="shrink-0 [&_svg]:size-5">
            {icon}
          </span>
          {badge != null && (
            <span className="flex shrink-0 items-center empty:hidden">
              {badge}
            </span>
          )}
        </span>
        <Text
          as="span"
          size="xs"
          weight="medium"
          variant={selected ? 'default' : 'muted'}
          className="w-full min-w-0 whitespace-normal [overflow-wrap:anywhere]"
        >
          {label}
        </Text>
      </>
    );

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        data-selected={selected ? 'true' : 'false'}
        className={cn(
          'flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] flex-1 basis-0 cursor-pointer flex-col items-center justify-start gap-1 px-0 py-2 text-center transition-colors duration-fast ease-move hover:bg-sidebar-selected active:bg-sidebar-selected-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          selected
            ? 'bg-sidebar-selected text-foreground'
            : 'text-muted-foreground',
          className,
        )}
        {...props}
      >
        {asChild ? (
          <Slottable child={children}>{() => content}</Slottable>
        ) : (
          content
        )}
      </Comp>
    );
  },
);
BottomNavigationItem.displayName = 'BottomNavigationItem';

export { BottomNavigation, BottomNavigationItem };
