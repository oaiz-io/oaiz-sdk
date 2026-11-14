import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';

export type ErrorStateProps = {
  error: { message: string };
  onRetry?: () => void;
  retrying?: boolean;
  labels?: { retry?: string; retrying?: string };
};

/** A failure and an explicit caller-owned recovery action. */
export function ErrorState({
  error,
  onRetry,
  retrying = false,
  labels,
}: ErrorStateProps) {
  return (
    <Alert variant="destructive" aria-busy={retrying}>
      <AlertDescription>{error.message}</AlertDescription>
      {onRetry && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={retrying}
          onClick={onRetry}
          className="mt-inline"
        >
          {retrying
            ? (labels?.retrying ?? 'Retrying…')
            : (labels?.retry ?? 'Retry')}
        </Button>
      )}
    </Alert>
  );
}
