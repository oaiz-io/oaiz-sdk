import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DtoActionLogOutput,
  DtoWorkflowRun,
  DtoWorkflowRunEvent,
  DtoWorkflowRunJob,
  OaizError,
  OaizResponse,
  OaizRunProgress,
  OaizRuns,
  OaizRunStart,
} from '@oaiz/sdk';

export type OaizRunInput = Omit<OaizRunStart, 'signal'>;

type RunJob = DtoWorkflowRunJob & { logs: DtoActionLogOutput[] };

export type OaizRunState = {
  runId: string | null;
  status: 'idle' | DtoWorkflowRun['status'];
  streaming: boolean;
  finished: boolean;
  jobs: RunJob[];
  events: DtoWorkflowRunEvent[];
  eventsPending: boolean;
  eventsTruncated: boolean;
  error: OaizError | null;
};

const INITIAL_RUN: OaizRunState = {
  runId: null,
  status: 'idle',
  streaming: false,
  finished: false,
  jobs: [],
  events: [],
  eventsPending: false,
  eventsTruncated: false,
  error: null,
};

function upsertJob(jobs: RunJob[], next: RunJob): RunJob[] {
  if (!jobs.some((job) => job.executionUuid === next.executionUuid)) return [...jobs, next];
  return jobs.map((job) => job.executionUuid === next.executionUuid ? next : job);
}

function addLog(logs: DtoActionLogOutput[], line: DtoActionLogOutput): DtoActionLogOutput[] {
  if (logs.some((log) => line.uuid ? log.uuid === line.uuid : line.sequence !== undefined && log.sequence === line.sequence)) {
    return logs;
  }
  return [...logs, line];
}

export function applyRunFrame(state: OaizRunState, frame: OaizResponse<OaizRunProgress>): OaizRunState {
  if (frame.error !== null) return { ...state, streaming: false, error: frame.error };
  const { event } = frame.data;
  switch (event.type) {
    case 'root_start':
      return { ...state, runId: event.actionExecutionLogUuid ?? state.runId, status: 'running', streaming: true };
    case 'execution_snapshot': {
      const execution = event.executionLog;
      if (!execution) return state;
      const current = state.jobs.find((job) => job.executionUuid === execution.uuid);
      return { ...state, jobs: upsertJob(state.jobs, {
        executionUuid: execution.uuid,
        jobUuid: execution.jobUuid,
        jobName: execution.jobName ?? current?.jobName ?? '',
        status: execution.status,
        logs: (execution.logs ?? []).reduce(addLog, current?.logs ?? []),
      }) };
    }
    case 'action_log': {
      const { actionExecutionLogUuid: executionUuid, actionLog, jobUuid, status } = event;
      if (!executionUuid || !actionLog || !jobUuid || !status) return state;
      const current = state.jobs.find((job) => job.executionUuid === executionUuid);
      return { ...state, jobs: upsertJob(state.jobs, {
        ...current,
        executionUuid,
        jobUuid,
        jobName: current?.jobName ?? '',
        status,
        logs: addLog(current?.logs ?? [], actionLog),
      }) };
    }
    case 'terminal':
    case 'waiting': {
      const run = event.run;
      if (run) {
        const logs = new Map(state.jobs.map((job) => [job.executionUuid, job.logs]));
        return {
          ...state,
          runId: run.runUuid,
          status: run.status,
          streaming: false,
          finished: run.finished,
          jobs: (run.jobs ?? []).map((job) => ({ ...job, logs: logs.get(job.executionUuid) ?? [] })),
          events: run.events ?? [],
          eventsPending: run.eventsPending,
          eventsTruncated: run.eventsTruncated,
        };
      }
      return {
        ...state,
        status: event.terminalReason === 'root-start-failure' ? 'failure' : state.status,
        streaming: false,
        error: {
          code: event.slug ?? event.terminalReason ?? 'run-stream-incomplete',
          message: event.message ?? 'The stream ended without a run snapshot.',
          hints: [],
        },
      };
    }
  }
  return state;
}

export function useOaizRun(runs: Pick<OaizRuns, 'start'>) {
  const [state, setState] = useState(INITIAL_RUN);
  const active = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (!active.current) return;
    active.current.abort();
    active.current = null;
    setState((current) => ({ ...current, streaming: false }));
  }, []);

  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
  }, []);

  const start = useCallback(async (input: OaizRunInput) => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState({ ...INITIAL_RUN, runId: input.runId ?? null, status: 'running', streaming: true });
    try {
      for await (const frame of runs.start({ ...input, signal: controller.signal })) {
        if (active.current !== controller) return;
        const endsStream = frame.error !== null || frame.data.event.type === 'terminal' || frame.data.event.type === 'waiting';
        // The iterator may still be closing after the result is visible.
        if (endsStream) active.current = null;
        setState((current) => applyRunFrame(current, frame));
        if (endsStream) return;
      }
      if (active.current === controller) {
        setState((current) => ({
          ...current,
          streaming: false,
          error: { code: 'run-stream-incomplete', message: 'The stream ended without a run snapshot.', hints: [] },
        }));
      }
    } catch (error) {
      if (active.current === controller) {
        setState((current) => ({
          ...current,
          streaming: false,
          error: { code: 'run-stream-error', message: error instanceof Error ? error.message : String(error), hints: [] },
        }));
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, [runs]);

  return { state, start, stop };
}
