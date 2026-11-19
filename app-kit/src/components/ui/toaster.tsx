import * as React from 'react';
import { useToast } from './use-toast';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest('input, textarea, select') !== null)
  );
}

const UNDO_KEYSHORTCUTS = 'Meta+Z Control+Z';

function ToastText({
  title,
  description,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      {title && <ToastTitle>{title}</ToastTitle>}
      {description && <ToastDescription>{description}</ToastDescription>}
    </div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  // Cmd+Z or Ctrl+Z undoes the newest open toast that offers Undo. Text
  // fields keep their own undo.
  const undoable = toasts.find((toast) => toast.open && toast.onUndo);
  React.useEffect(() => {
    const onUndo = undoable?.onUndo;
    if (!undoable || !onUndo) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.key.toLowerCase() !== 'z' ||
        !(event.metaKey || event.ctrlKey) ||
        event.shiftKey ||
        event.altKey ||
        isTypingTarget(event.target)
      )
        return;
      event.preventDefault();
      dismiss(undoable.id);
      onUndo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismiss, undoable]);

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        layout = 'inline',
        onUndo,
        testId,
        ...props
      }) {
        const keyshortcuts = onUndo ? UNDO_KEYSHORTCUTS : undefined;

        if (layout === 'stacked') {
          return (
            <Toast
              key={id}
              data-testid={testId}
              aria-keyshortcuts={keyshortcuts}
              {...props}
            >
              <div className="flex min-w-0 flex-col gap-2">
                <ToastText title={title} description={description} />
                {action ? (
                  <div
                    className="flex flex-wrap items-center gap-inline"
                    data-testid="toast-actions"
                  >
                    {action}
                  </div>
                ) : null}
              </div>
              <ToastClose className="top-1/2 -translate-y-1/2" />
            </Toast>
          );
        }

        return (
          <Toast
            key={id}
            data-testid={testId}
            aria-keyshortcuts={keyshortcuts}
            {...props}
          >
            <ToastText title={title} description={description} />
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
