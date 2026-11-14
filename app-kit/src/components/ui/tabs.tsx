import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '../../lib/utils';

const Tabs = TabsPrimitive.Root;
type TabsVariant = 'default' | 'underline';
type TabsSize = 'default' | 'compact';

interface TabsListProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.List
> {
  variant?: TabsVariant;
  size?: TabsSize;
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant = 'default', size = 'default', ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center text-muted-foreground',
      variant === 'underline'
        ? cn(
            'justify-start gap-inline border-b border-border bg-background p-0',
            size === 'compact' ? 'h-6' : 'h-11',
          )
        : cn(
            'justify-center rounded-md bg-muted',
            size === 'compact' ? 'h-7 p-0.5' : 'h-10 p-1',
          ),
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    variant?: TabsVariant;
    size?: TabsSize;
  }
>(({ className, variant = 'default', size = 'default', ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap font-medium outline-none ring-offset-background transition-all duration-fast ease-move focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      size === 'compact'
        ? 'h-6 min-h-6 min-w-6 px-2 text-2xs'
        : 'px-3 py-1.5 text-sm',
      variant === 'underline'
        ? 'h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary'
        : 'rounded-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 outline-none ring-offset-background duration-fast ease-enter data-[state=active]:animate-in data-[state=active]:fade-in-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
