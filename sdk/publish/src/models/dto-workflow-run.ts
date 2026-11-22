import type * as models from "./index";

export interface DtoWorkflowRun {
  completedAt?: string;
  events: models.DtoWorkflowRunEvent[] | null;
  eventsPending: boolean;
  eventsTruncated: boolean;
  finished: boolean;
  jobs: models.DtoWorkflowRunJob[] | null;
  rootJobUuid: string;
  runUuid: string;
  startedAt?: string;
  status: models.DtoWorkflowRunStatus;
  workflowTraceId?: string;
  workflowUuid?: string;
}
