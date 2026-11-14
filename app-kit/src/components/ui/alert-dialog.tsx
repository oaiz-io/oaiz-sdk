import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

export const AlertDialog = Dialog;
export const AlertDialogTrigger = DialogTrigger;
export const AlertDialogTitle = DialogTitle;
export const AlertDialogDescription = DialogDescription;
export const AlertDialogHeader = DialogHeader;
export const AlertDialogFooter = DialogFooter;

/** An explicit decision cannot be accepted or dismissed by clicking its backdrop. */
export const AlertDialogContent = forwardRef<
  ElementRef<typeof DialogContent>,
  ComponentPropsWithoutRef<typeof DialogContent>
>(({ onOpenAutoFocus, onInteractOutside, ...props }, ref) => {
  const content = useRef<ElementRef<typeof DialogContent>>(null);
  useImperativeHandle(ref, () => content.current!);
  return (
    <DialogContent
      {...props}
      ref={content}
      role="alertdialog"
      showCloseButton={false}
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event);
        if (!event.defaultPrevented) {
          const cancel = content.current?.querySelector<HTMLElement>(
            '[data-alert-dialog-cancel]',
          );
          if (cancel) {
            event.preventDefault();
            cancel.focus();
          }
        }
      }}
      onInteractOutside={(event) => {
        onInteractOutside?.(event);
        event.preventDefault();
      }}
    />
  );
});
AlertDialogContent.displayName = 'AlertDialogContent';

export const AlertDialogCancel = forwardRef<
  ElementRef<typeof DialogClose>,
  ComponentPropsWithoutRef<typeof DialogClose>
>((props, ref) => (
  <DialogClose {...props} ref={ref} data-alert-dialog-cancel="" />
));
AlertDialogCancel.displayName = 'AlertDialogCancel';
export const AlertDialogAction = DialogClose;
