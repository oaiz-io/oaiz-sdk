import type { ReactNode } from 'react';

import { cn } from '../lib/utils';

export type StatusDotTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

export type StatusDotProps = {
  children: ReactNode;
  tone?: StatusDotTone;
  className?: string;
};

/** Each tone's dot colour, for a mark beside a status that is not a `StatusDot`. */
export const STATUS_DOT_TONES: Record<StatusDotTone, string> = {
  neutral: 'bg-muted-foreground',
  info: 'bg-info-solid',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
};

/** A status as plain text with a small dot, so that it does not compete with the data around it. */
export function StatusDot({
  children,
  tone = 'neutral',
  className,
}: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', className)}>
      <StatusMark tone={tone} />
      {children}
    </span>
  );
}

/** A decorative status mark beside a separately rendered label. */
export function StatusMark({
  tone = 'neutral',
  className,
}: Pick<StatusDotProps, 'tone' | 'className'>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'size-2 shrink-0 rounded-full',
        STATUS_DOT_TONES[tone],
        className,
      )}
    />
  );
}
