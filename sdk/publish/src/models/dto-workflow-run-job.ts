import type * as models from "./index";

export interface DtoWorkflowRunJob {
  completedAt?: string;
  executionUuid: string;
  jobName: string;
  jobUuid: string;
  startedAt?: string;
  status: models.DtoExecutionStatus;
}
