/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import { cspNonce } from '../../lib/csp-nonce';
import { cn, usePointerCloseFocus } from '../../lib/utils';
import { Text } from './text';

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const selectTriggerVariants = cva(
  'flex w-full items-center justify-between rounded-md px-inset text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-fast ease-move aria-invalid:border-destructive-text aria-invalid:focus-visible:ring-destructive-text [&>span]:truncate [&>span]:min-w-0',
  {
    variants: {
      size: {
        default: 'h-10 py-inline',
        sm: 'h-9',
      },
      variant: {
        default:
          'border border-input bg-background focus-visible:not-data-[pointer-close-focus]:ring-2 focus-visible:not-data-[pointer-close-focus]:ring-ring focus-visible:not-data-[pointer-close-focus]:ring-offset-2',
        filled:
          'border border-transparent bg-input-fill text-foreground data-[placeholder]:text-muted-foreground hover:bg-input-fill-hover focus-visible:not-data-[pointer-close-focus]:border-input focus-visible:not-data-[pointer-close-focus]:bg-background focus-visible:not-data-[pointer-close-focus]:ring-2 focus-visible:not-data-[pointer-close-focus]:ring-ring focus-visible:not-data-[pointer-close-focus]:ring-offset-2 disabled:hover:bg-input-fill aria-invalid:border-destructive-text aria-invalid:focus-visible:border-destructive-text',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
  },
);

export interface SelectTriggerProps
  extends
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    VariantProps<typeof selectTriggerVariants> {}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, variant, size, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(selectTriggerVariants({ variant, size, className }))}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className,
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className,
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(
  (
    {
      className,
      children,
      position = 'popper',
      onPointerDownCapture,
      onClickCapture,
      onKeyDownCapture,
      onEscapeKeyDown,
      onPointerDownOutside,
      onCloseAutoFocus,
      ...props
    },
    ref,
  ) => {
    const pointerCloseFocus = usePointerCloseFocus({
      onPointerDownCapture,
      onClickCapture,
      onKeyDownCapture,
      onEscapeKeyDown,
      onPointerDownOutside,
      onCloseAutoFocus,
    });

    return (
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          ref={ref}
          className={cn(
            'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-foreground shadow-md outline-none duration-fast ease-enter data-[state=closed]:ease-exit data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            position === 'popper' &&
              'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
            className,
          )}
          position={position}
          {...pointerCloseFocus}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.Viewport
            nonce={cspNonce()}
            className={cn(
              'p-1',
              position === 'popper' &&
                'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
            )}
          >
            {children}
          </SelectPrimitive.Viewport>
          <SelectScrollDownButton />
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    );
  },
);
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <Text
    asChild
    size="sm"
    weight="semibold"
    className={cn('py-1.5 pl-section pr-inline', className)}
  >
    <SelectPrimitive.Label ref={ref} {...props} />
  </Text>
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

export interface SelectItemProps extends React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Item
> {
  selectionIndicator?: 'check' | 'highlight';
}

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, selectionIndicator = 'check', ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 text-sm outline-none focus:bg-accent focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      selectionIndicator === 'check'
        ? 'pl-section pr-inline'
        : 'px-inset data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus:ring-2 focus:ring-inset focus:ring-ring data-[state=checked]:focus:ring-primary-foreground',
      className,
    )}
    {...props}
  >
    {selectionIndicator === 'check' && (
      <span className="absolute left-inline flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
    )}

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
  selectTriggerVariants,
};
