import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { cn } from '../../lib/utils';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleContent
    ref={ref}
    className={cn(
      'overflow-hidden data-[state=closed]:animate-[oaiz-collapsible-collapse_var(--transition-duration-normal)_var(--ease-move)] data-[state=open]:animate-[oaiz-collapsible-expand_var(--transition-duration-normal)_var(--ease-move)]',
      className,
    )}
    {...props}
  >
    {children}
  </CollapsiblePrimitive.CollapsibleContent>
));
CollapsibleContent.displayName =
  CollapsiblePrimitive.CollapsibleContent.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
