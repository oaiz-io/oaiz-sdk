import type { ReactNode } from 'react';
import type { DtoExecutionStatus } from '@oaiz/sdk';

import type { OaizRunInput, OaizRunState, useOaizRun } from '../hooks/oaiz-run';
import { cn } from '../lib/utils';
import { StatusDot, type StatusDotTone } from './status-dot';
import { Button } from './ui/button';

type Status = { label: string; tone: StatusDotTone };

const RUN_STATUS: Record<OaizRunState['status'], Status> = {
  idle: { label: 'Not started', tone: 'neutral' },
  running: { label: 'Running', tone: 'info' },
  success: { label: 'Succeeded', tone: 'success' },
  failure: { label: 'Failed', tone: 'danger' },
  'not-triggered': { label: 'Did not run', tone: 'neutral' },
  'awaiting-approval': { label: 'Waiting for approval', tone: 'warning' },
  'awaiting-delay': { label: 'Waiting for delay', tone: 'warning' },
};

const JOB_STATUS: Record<DtoExecutionStatus, Status> = {
  executing: RUN_STATUS.running,
  success: RUN_STATUS.success,
  failure: RUN_STATUS.failure,
  'awaiting-approval': RUN_STATUS['awaiting-approval'],
  'awaiting-delay': RUN_STATUS['awaiting-delay'],
  'awaiting-event': { label: 'Waiting for event', tone: 'warning' },
  'not-executed': RUN_STATUS['not-triggered'],
  'budget-exceeded': { label: 'Budget exceeded', tone: 'danger' },
  rejected: { label: 'Rejected', tone: 'danger' },
  timeout: { label: 'Timed out', tone: 'danger' },
};

export type RunButtonProps = {
  run: Pick<ReturnType<typeof useOaizRun>, 'start' | 'state'>;
  input: OaizRunInput;
  children?: ReactNode;
  runningLabel?: string;
  disabled?: boolean;
  className?: string;
};

export function RunButton({
  run, input, children = 'Run workflow', runningLabel = 'Running…', disabled, className,
}: RunButtonProps) {
  return (
    <Button
      type="button"
      className={className}
      disabled={disabled || run.state.streaming}
      onClick={() => void run.start(input)}
    >
      {run.state.streaming ? runningLabel : children}
    </Button>
  );
}

export type RunProgressLabels = {
  runStatus?: Partial<Record<OaizRunState['status'], string>>;
  jobStatus?: Partial<Record<DtoExecutionStatus, string>>;
  updatesStopped?: string;
  jobs?: string;
  events?: string;
  final?: string;
  pending?: string;
  truncated?: string;
  pendingOutsideList?: string;
};

export type RunProgressProps = { state: OaizRunState; className?: string; labels?: RunProgressLabels };

export function RunProgress({ state, className, labels }: RunProgressProps) {
  const status = RUN_STATUS[state.status];
  const paused = state.status === 'running' && !state.streaming;
  const eventsLabel = labels?.events ?? 'Published events';
  return (
    <div className={cn('flex flex-col gap-inline text-sm', className)}>
      <div role="status">
        <StatusDot tone={paused ? 'neutral' : status.tone}>
          {paused
            ? labels?.updatesStopped ?? 'Progress updates stopped'
            : labels?.runStatus?.[state.status] ?? status.label}
        </StatusDot>
      </div>
      {state.error && <p role="alert" className="text-destructive-text">{state.error.message}</p>}
      {state.jobs.length > 0 && (
        <ul aria-label={labels?.jobs ?? 'Jobs'} className="divide-y divide-border">
          {state.jobs.map((job) => (
            <li key={job.executionUuid} className="flex flex-wrap items-baseline justify-between gap-x-inline py-2">
              <span className="min-w-0 break-words font-medium">{job.jobName || job.jobUuid}</span>
              <StatusDot tone={JOB_STATUS[job.status].tone}>
                {labels?.jobStatus?.[job.status] ?? JOB_STATUS[job.status].label}
              </StatusDot>
            </li>
          ))}
        </ul>
      )}
      {state.events.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="font-medium">{eventsLabel}</p>
          <ul aria-label={eventsLabel} className="divide-y divide-border">
            {state.events.map((event) => (
              <li key={event.uuid} className="flex flex-wrap items-baseline justify-between gap-x-inline py-2">
                <span className="min-w-0 break-words">{event.identifier}</span>
                {event.final && <span className="text-muted-foreground">{labels?.final ?? 'Final'}</span>}
                {event.pending && <span className="text-muted-foreground">{labels?.pending ?? 'not stored yet'}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {state.eventsTruncated && (
        <p className="text-muted-foreground">{labels?.truncated ?? 'More events are recorded for this run.'}</p>
      )}
      {state.eventsTruncated && state.eventsPending && !state.events.some((event) => event.pending) && (
        <p className="text-muted-foreground">
          {labels?.pendingOutsideList ?? 'Some events outside this list are not stored yet.'}
        </p>
      )}
    </div>
  );
}
