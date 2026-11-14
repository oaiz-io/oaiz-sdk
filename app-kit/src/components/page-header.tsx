import type { ReactNode } from 'react';

import { cn } from '../lib/utils';
import { Heading } from './ui/heading';
import { Text } from './ui/text';

export type PageHeaderProps = {
  title: ReactNode;
  /** One muted line under the title, such as how many records there are. */
  summary?: ReactNode;
  /** The page's primary action, an `sm` button. Other actions go in a menu. */
  action?: ReactNode;
  className?: string;
};

/** The top of a page that leaves `title` off `AppShell`: one title, its summary and one action. */
export function PageHeader({ title, summary, action, className }: PageHeaderProps) {
  return (
    <header className={cn('flex items-start justify-between gap-stack px-page pb-stack pt-section', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <Heading level={1} size="md" className="truncate">
          {title}
        </Heading>
        {summary && (
          <Text size="sm" variant="muted">
            {summary}
          </Text>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-inline">{action}</div>}
    </header>
  );
}
