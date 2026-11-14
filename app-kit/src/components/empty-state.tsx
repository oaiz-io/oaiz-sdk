import type { ReactNode } from 'react';

import { cn } from '../lib/utils';
import { Text } from './ui/text';

export type EmptyStateProps = {
  /** What belongs here, such as "No orders yet". */
  title: ReactNode;
  /** What a record here is for, or how one gets here. */
  description?: ReactNode;
  /** The button that adds the first record. */
  action?: ReactNode;
  className?: string;
};

/** A place with no records: says what belongs here and offers the action that adds one. */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-inline px-page py-section text-center', className)}>
      <Text size="sm" weight="medium">
        {title}
      </Text>
      {description && (
        <Text size="sm" variant="muted">
          {description}
        </Text>
      )}
      {action && <div className="mt-1 flex items-center gap-inline">{action}</div>}
    </div>
  );
}
