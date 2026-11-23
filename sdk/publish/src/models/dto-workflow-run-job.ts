import type * as models from "./index";

export interface DtoWorkflowRunJob {
  completedAt?: string;
  error?: string;
  executionUuid: string;
  jobName: string;
  jobUuid: string;
  startedAt?: string;
  status: models.DtoExecutionStatus;
}
