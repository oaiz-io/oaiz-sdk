import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible';
import { cn } from '../../lib/utils';

import { Heading, type HeadingLevel } from './heading';
import { Text } from './text';
import { Button } from './button';
interface DetailDisclosureSectionProps {
  title: string;
  /** Outline level of the title; nest it one below the enclosing heading. */
  headingLevel?: HeadingLevel;
  children: ReactNode;
  secondary?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  defaultOpen?: boolean;
  density?: 'default' | 'compact';
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
  /** Localized accessible name for the current disclosure action. */
  getToggleLabel?: (open: boolean, title: string) => string;
  testId?: string;
  triggerTestId?: string;
  chevronTestId?: string;
}

export function DetailDisclosureSection({
  title,
  headingLevel = 3,
  children,
  secondary,
  meta,
  trailing,
  defaultOpen = false,
  density = 'default',
  className,
  contentClassName,
  ariaLabel = title,
  getToggleLabel = (expanded, name) =>
    `${expanded ? 'Collapse' : 'Expand'} ${name}`,
  testId,
  triggerTestId,
  chevronTestId,
}: DetailDisclosureSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('min-w-0', className)}
      data-testid={testId}
    >
      <div className="flex min-w-0 items-stretch border-b border-border">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="plain"
            aria-label={getToggleLabel(open, ariaLabel)}
            className={cn(
              'flex h-auto min-w-0 flex-1 flex-wrap justify-start gap-inline whitespace-normal px-inline text-left hover:bg-muted/50',
              density === 'compact' ? 'py-inline' : 'py-inset',
            )}
            data-testid={triggerTestId}
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-fast ease-move',
                open && 'rotate-90',
              )}
              data-testid={chevronTestId}
            />
            <Heading
              level={headingLevel}
              size={density === 'compact' ? 'xs' : undefined}
              variant="default"
              className="min-w-0 [overflow-wrap:anywhere]"
            >
              {title}
            </Heading>
            {secondary ? (
              <Text
                as="span"
                size={density === 'compact' ? 'xs' : 'sm'}
                className="min-w-0 truncate"
              >
                {secondary}
              </Text>
            ) : null}
            {meta ? <span className="ml-auto shrink-0">{meta}</span> : null}
          </Button>
        </CollapsibleTrigger>
        {trailing ? (
          <div className="flex shrink-0 items-center px-inline">{trailing}</div>
        ) : null}
      </div>
      <CollapsibleContent className={contentClassName}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
