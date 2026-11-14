import { useMemo } from 'react';
import { cn } from '../lib/utils';
import { Alert, AlertDescription } from './ui/alert';
import { Text } from './ui/text';
import { compareText, compactTextDiff } from './text-diff-model';

export type TextDiffProps = {
  before: string;
  after: string;
  label: string;
  /** Show three lines around each change and name omitted ranges. */
  compact?: boolean;
  className?: string;
  labels?: {
    summary?: (added: number, removed: number) => string;
    unchanged?: string;
    tooLarge?: string;
    omitted?: (count: number) => string;
    added?: string;
    removed?: string;
  };
};

/** Text-only change presentation; neither input is interpreted as markup. */
export function TextDiff({
  before,
  after,
  label,
  compact = true,
  className,
  labels,
}: TextDiffProps) {
  const result = useMemo(() => compareText(before, after), [before, after]);
  if (result.status === 'too-large')
    return (
      <Alert variant="warning">
        <AlertDescription>
          {labels?.tooLarge ??
            'This comparison is too large. Compare a smaller section.'}
        </AlertDescription>
      </Alert>
    );
  const lines = compact ? compactTextDiff(result.lines) : result.lines;
  return (
    <div className={cn('min-w-0 space-y-inline', className)}>
      <Text size="sm" variant="muted">
        {result.added || result.removed
          ? (labels?.summary?.(result.added, result.removed) ??
            `${result.added} added, ${result.removed} removed`)
          : (labels?.unchanged ?? 'No changes')}
      </Text>
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="max-h-96 overflow-auto rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-full w-max whitespace-pre py-inline font-mono text-sm">
          {lines.map((line, index) =>
            line.type === 'gap' ? (
              <div key={index} className="px-inset text-muted-foreground">
                {labels?.omitted?.(line.count) ??
                  `… ${line.count} unchanged lines …`}
              </div>
            ) : (
              <div
                key={index}
                className={cn(
                  'flex px-inset',
                  line.type === 'insert' &&
                    'bg-success-bg-subtle text-success-text',
                  line.type === 'delete' &&
                    'bg-destructive-bg-subtle text-destructive-text',
                )}
              >
                <span aria-hidden="true" className="w-6 shrink-0 select-none">
                  {line.type === 'insert'
                    ? '+'
                    : line.type === 'delete'
                      ? '−'
                      : ' '}
                </span>
                {line.type !== 'equal' && (
                  <span className="sr-only">
                    {line.type === 'insert'
                      ? (labels?.added ?? 'Added: ')
                      : (labels?.removed ?? 'Removed: ')}
                  </span>
                )}
                <code>{line.text || ' '}</code>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
