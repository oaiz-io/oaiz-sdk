import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Heading } from './heading';
import { Text } from './text';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 duration-normal ease-enter data-[state=closed]:ease-exit data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> & {
  motion?: 'default' | 'fade';
  closeLabel?: string;
  showCloseButton?: boolean;
  /** Replaces parts of the overlay's look, such as a lighter backdrop. */
  overlayClassName?: string;
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      motion = 'default',
      closeLabel = 'Close',
      showCloseButton = true,
      overlayClassName,
      ...props
    },
    ref,
  ) => {
    const motionClasses =
      motion === 'fade'
        ? 'duration-normal ease-enter data-[state=closed]:ease-exit data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98'
        : 'duration-normal ease-enter data-[state=closed]:ease-exit data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95';

    return (
      <DialogPortal>
        <DialogOverlay className={overlayClassName} />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            'fixed left-[50%] top-[50%] z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-stack border bg-background p-6 shadow-lg outline-none mobile:rounded-lg',
            motionClasses,
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close
              className="absolute right-stack top-stack flex h-6 w-6 items-center justify-center rounded-sm opacity-70 outline-none ring-offset-background transition-opacity duration-fast ease-move hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
              data-testid="dialog-close-button"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">{closeLabel}</span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center mobile:text-left',
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse mobile:flex-row mobile:justify-end mobile:space-x-inline',
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <Heading
    asChild
    level={3}
    size="lg"
    weight="semibold"
    className={cn('leading-none tracking-tight', className)}
  >
    <DialogPrimitive.Title ref={ref} {...props} />
  </Heading>
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <Text asChild size="sm" variant="muted" className={className}>
    <DialogPrimitive.Description ref={ref} {...props} />
  </Text>
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
