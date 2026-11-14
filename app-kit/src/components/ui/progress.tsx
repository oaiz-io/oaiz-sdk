import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '../../lib/utils';

interface ProgressProps extends React.ComponentPropsWithoutRef<
  typeof ProgressPrimitive.Root
> {
  /** Colours the filled part, for a meter whose fill carries meaning. */
  indicatorClassName?: string;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, indicatorClassName, value, max = 100, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    value={value}
    max={max}
    className={cn(
      'relative h-4 w-full overflow-hidden rounded-full bg-secondary',
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        'h-full w-full flex-1 bg-primary transition-transform duration-slow ease-move',
        indicatorClassName,
      )}
      style={{ transform: `translateX(-${100 - ((value ?? 0) / max) * 100}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
