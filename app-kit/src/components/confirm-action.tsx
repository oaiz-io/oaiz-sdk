import { useRef, useState, type ReactNode } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { Button } from './ui/button';

export type ConfirmActionProps = {
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pendingLabel?: string;
  errorLabel?: string;
  onConfirm: () => unknown;
  /** Supply a button element; controlled consumers can instead pass open/onOpenChange. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  destructive?: boolean;
};

export function ConfirmAction({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  pendingLabel = 'Working…',
  errorLabel = 'The action failed. Try again.',
  onConfirm,
  trigger,
  open: controlledOpen,
  onOpenChange,
  destructive = false,
}: ConfirmActionProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const origin = useRef<HTMLElement | null>(null);
  const open = controlledOpen ?? internalOpen;
  function changeOpen(next: boolean) {
    if (inFlight.current) return;
    setInternalOpen(next);
    setError(null);
    onOpenChange?.(next);
  }
  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      inFlight.current = false;
      changeOpen(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : errorLabel);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent
        onOpenAutoFocus={() => {
          origin.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          if (
            !trigger &&
            origin.current?.isConnected &&
            origin.current !== document.body
          ) {
            event.preventDefault();
            origin.current.focus();
          }
        }}
        aria-busy={pending}
        onEscapeKeyDown={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={pending}>
              {cancelLabel}
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={() => void confirm()}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
