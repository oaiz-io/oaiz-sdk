import { Check } from 'lucide-react';

import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Text } from './ui/text';

/** A step's indicator and label; a done step's button and a plain step take the same room. */
const ITEM = 'flex h-auto min-h-11 min-w-0 flex-1 items-center justify-start gap-inline whitespace-normal px-1 py-0.5 text-left mobile:min-h-8 mobile:flex-initial';

export type StepperStep = { key: string; label: string };

export type StepperProps = {
  steps: readonly StepperStep[];
  /** The key of the step on screen. Steps before it are done, steps after it are upcoming. */
  current: string;
  /** Makes each done step a button that returns to it. */
  onStepSelect?: (key: string) => void;
  /** The name of the list for a screen reader. */
  label?: string;
  className?: string;
  /** True only after the final step has been submitted successfully. */
  complete?: boolean;
  messages?: {
    position?: (step: number, total: number) => string;
    done?: string;
    completed?: string;
  };
};

/**
 * The steps of a form in several parts: done, current and upcoming, as an ordered list with
 * `aria-current="step"`. A phone stacks the steps below a progress summary.
 */
export function Stepper({
  steps,
  current,
  onStepSelect,
  label = 'Steps',
  className,
  complete = false,
  messages,
}: StepperProps) {
  const at = Math.max(
    0,
    steps.findIndex((step) => step.key === current),
  );
  const currentStep = steps[at];
  const position =
    messages?.position?.(at + 1, steps.length) ??
    `Step ${at + 1} of ${steps.length}`;
  if (steps.length === 0) return null;

  return (
    <nav aria-label={label} className={cn('min-w-0 space-y-inline', className)}>
      <div className="flex flex-col gap-inline mobile:hidden">
        <Text size="sm" variant="muted">
          {complete ? (messages?.completed ?? 'Completed') : position}
          {currentStep && (
            <>
              {' · '}
              <Text as="span" size="sm" weight="medium">
                {currentStep.label}
              </Text>
            </>
          )}
        </Text>
        <Progress
          value={complete ? 100 : (at / steps.length) * 100}
          aria-label={label}
          getValueLabel={() =>
            complete ? (messages?.completed ?? 'Completed') : position
          }
          className="h-1"
        />
      </div>
      <ol className="flex flex-col gap-inline mobile:flex-row mobile:flex-wrap mobile:items-center">
        {steps.map((step, index) => {
          const state =
            complete || index < at
              ? 'done'
              : index === at
                ? 'current'
                : 'upcoming';
          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors duration-normal ease-move [&_svg]:size-3.5',
                  state === 'done' &&
                    'border-primary bg-primary text-primary-foreground',
                  state === 'current' &&
                    'border-primary text-foreground ring-2 ring-primary/20',
                  state === 'upcoming' && 'text-muted-foreground',
                )}
              >
                {state === 'done' ? <Check strokeWidth={3} /> : index + 1}
              </span>
              <Text
                as="span"
                size="sm"
                weight={state === 'current' ? 'medium' : 'normal'}
                variant={state === 'upcoming' ? 'muted' : 'default'}
                className="min-w-0 [overflow-wrap:anywhere]"
              >
                {step.label}
              </Text>
              {state === 'done' && (
                <span className="sr-only">, {messages?.done ?? 'done'}</span>
              )}
            </>
          );
          return (
            <li
              key={step.key}
              aria-current={state === 'current' ? 'step' : undefined}
              className={cn(
                'flex min-w-0 items-center gap-inline',
                index < steps.length - 1 && 'mobile:flex-1',
              )}
            >
              {state === 'done' && onStepSelect ? (
                <Button
                  type="button"
                  variant="plain"
                  onClick={() => onStepSelect(step.key)}
                  className={cn(
                    ITEM,
                    'rounded-md transition-colors duration-fast ease-move hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  {content}
                </Button>
              ) : (
                <span className={ITEM}>{content}</span>
              )}
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'hidden h-px min-w-4 flex-1 transition-colors duration-normal ease-move mobile:block',
                    index < at ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
