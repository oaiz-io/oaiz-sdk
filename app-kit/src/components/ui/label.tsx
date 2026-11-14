import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';
import { Text } from './text';

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <Text
    asChild
    as="label"
    size="sm"
    weight="medium"
    leading="none"
    className={cn(labelVariants(), className)}
  >
    <LabelPrimitive.Root ref={ref} {...props} />
  </Text>
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
