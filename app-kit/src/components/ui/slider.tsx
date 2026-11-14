import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '../../lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    /** Accessible names for individual handles in a range slider. */
    thumbLabels?: string[];
  }
>(
  (
    {
      className,
      thumbLabels,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      ...props
    },
    ref,
  ) => (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        'relative flex w-full touch-none select-none items-center',
        className,
        thumbLabels,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {(props.value ?? props.defaultValue ?? [0]).map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          aria-label={thumbLabels?.[index] ?? ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-[color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,transform,translate,scale,rotate] duration-fast ease-move hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  ),
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
