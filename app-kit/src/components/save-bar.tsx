import { useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { ConfirmAction } from './confirm-action';
import { Button } from './ui/button';
import { Text } from './ui/text';

export type SaveBarLabels = {
  dirty: string;
  saving: string;
  saved: string;
  error: string;
  save: string;
  discard: string;
};
const defaults: SaveBarLabels = {
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Changes could not be saved.',
  save: 'Save changes',
  discard: 'Discard',
};
export type SaveBarProps = {
  dirty: boolean;
  saving?: boolean;
  saved?: boolean;
  error?: { message: string } | null;
  onSave: () => unknown;
  onDiscard: () => void;
  labels?: Partial<SaveBarLabels>;
  className?: string;
};
export function SaveBar({
  dirty,
  saving = false,
  saved = false,
  error,
  onSave,
  onDiscard,
  labels: suppliedLabels,
  className,
}: SaveBarProps) {
  const labels = { ...defaults, ...suppliedLabels };
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inFlight = useRef(false);
  const busy = saving || pending;
  async function save() {
    if (!dirty || saving || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    try {
      await onSave();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : labels.error);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  if (!dirty && !busy && !saved && !error && !failure) return null;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-inline rounded-md border bg-background p-inset',
        className,
      )}
      aria-busy={busy}
    >
      <Text
        size="sm"
        role={error || failure ? 'alert' : 'status'}
        variant={error || failure ? 'destructive' : 'muted'}
      >
        {error?.message ??
          failure ??
          (busy ? labels.saving : dirty ? labels.dirty : labels.saved)}
      </Text>
      {dirty && (
        <div className="flex gap-inline">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!inFlight.current) {
                setFailure(null);
                onDiscard();
              }
            }}
          >
            {labels.discard}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? labels.saving : labels.save}
          </Button>
        </div>
      )}
    </div>
  );
}

export type UnsavedChangesProps = {
  /** The consuming router/dialog sets open when a dirty editor requests to leave. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => unknown;
  title?: ReactNode;
  description?: ReactNode;
  discardLabel?: string;
  keepEditingLabel?: string;
  pendingLabel?: string;
  errorLabel?: string;
};
/** Explicit navigation policy: close without discarding to keep editing; resolve discard to leave. */
export function UnsavedChanges({
  open,
  onOpenChange,
  onDiscard,
  title = 'Discard unsaved changes?',
  description = 'Your changes have not been saved.',
  discardLabel = 'Discard changes',
  keepEditingLabel = 'Keep editing',
  pendingLabel,
  errorLabel,
}: UnsavedChangesProps) {
  return (
    <ConfirmAction
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={discardLabel}
      cancelLabel={keepEditingLabel}
      pendingLabel={pendingLabel}
      errorLabel={errorLabel}
      onConfirm={onDiscard}
      destructive
    />
  );
}
