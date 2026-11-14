import type * as models from "./index";

export interface DtoActionExecutionRunSummary {
  completedAt?: string;
  completedSteps: number;
  durationMs?: number;
  emittedOutput: boolean;
  executionUuids: string[] | null;
  jobs: models.DtoActionExecutionRunJobSummary[] | null;
  organisationUuid: string;
  sourceExecutionUuid?: string;
  startedAt?: string;
  status: models.DtoExecutionStatus;
  stoppedAtJobName?: string;
  stoppedAtJobUuid?: string;
  totalSteps: number;
  workflowTraceId: string;
}
