import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '../../lib/utils';
import { Text } from './text';

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ onFocus, ...props }, ref) => (
  <TooltipPrimitive.Trigger
    {...props}
    ref={ref}
    onFocus={(event) => {
      onFocus?.(event);
      // Radix skips its open handler when the composed handler prevents the event.
      if (event.currentTarget.hasAttribute('data-pointer-close-focus')) {
        event.preventDefault();
      }
    }}
  />
));
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

interface TooltipContentProps extends React.ComponentPropsWithoutRef<
  typeof TooltipPrimitive.Content
> {
  size?: 'xs' | 'sm';
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, sideOffset = 4, size = 'sm', ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <Text
      asChild
      size={size}
      className={cn(
        'z-50 overflow-hidden rounded-md border bg-popover px-inset py-1.5 text-foreground shadow-md duration-fast ease-enter animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
    >
      <TooltipPrimitive.Content ref={ref} sideOffset={sideOffset} {...props} />
    </Text>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
