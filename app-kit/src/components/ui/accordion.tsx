import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronRight } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Heading } from './heading';
import { Text } from './text';

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('border-b border-border', className)}
    {...props}
  />
));
AccordionItem.displayName = AccordionPrimitive.Item.displayName;

const AccordionHeader = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Header>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Header>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Header
    ref={ref}
    className={cn('flex min-w-0', className)}
    {...props}
  />
));
AccordionHeader.displayName = AccordionPrimitive.Header.displayName;

export interface AccordionTriggerProps extends React.ComponentPropsWithoutRef<
  typeof AccordionPrimitive.Trigger
> {
  chevronPosition?: 'start' | 'end';
}

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  AccordionTriggerProps
>(({ className, children, chevronPosition = 'start', ...props }, ref) => {
  const chevron = (
    <ChevronRight
      aria-hidden="true"
      className={cn(
        'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-fast ease-move group-data-[state=open]:rotate-90',
        chevronPosition === 'end' && 'ml-auto',
      )}
    />
  );
  return (
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'group flex min-w-0 flex-1 items-center gap-1.5 rounded-md p-inset text-left outline-none ring-offset-background transition-colors duration-fast ease-move',
        'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
        className,
      )}
      {...props}
    >
      {chevronPosition === 'start' && chevron}
      {children}
      {chevronPosition === 'end' && chevron}
    </AccordionPrimitive.Trigger>
  );
});
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

export interface AccordionContentProps extends React.ComponentPropsWithoutRef<
  typeof AccordionPrimitive.Content
> {
  /** Classes applied to the measured content wrapper rather than the animated node. */
  innerClassName?: string;
}

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  AccordionContentProps
>(({ className, innerClassName, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden data-[state=closed]:animate-[oaiz-accordion-collapse_var(--transition-duration-normal)_var(--ease-move)] data-[state=open]:animate-[oaiz-accordion-expand_var(--transition-duration-normal)_var(--ease-move)]',
      className,
    )}
    {...props}
  >
    <div className={innerClassName}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

function AccordionTitle({
  className,
  ...props
}: React.ComponentProps<typeof Heading>) {
  return (
    <Heading
      as="span"
      size="sm"
      weight="semibold"
      variant="default"
      className={cn('block font-inter leading-tight tracking-tight', className)}
      {...props}
    />
  );
}

function AccordionDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      as="span"
      size="xs"
      weight="medium"
      leading="normal"
      variant="muted"
      className={cn('block font-inter', className)}
      {...props}
    />
  );
}

export {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionContent,
  AccordionTitle,
  AccordionDescription,
};
