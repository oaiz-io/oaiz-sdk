import type * as models from "./index";

export interface DtoTestRunResult {
  branchId?: string;
  completedAt: string;
  error?: string;
  executions?: models.DtoActionExecutionLog[];
  flags: models.DtoTestRunFlags;
  inputEvent?: models.DtoEventInputOutput;
  jobs: models.DtoTestRunJobResult[] | null;
  kind: models.DtoTestRunKind;
  overallStatus: models.DtoTestRunStatus;
  sourceEventUuid?: string;
  startedAt: string;
  state?: models.DtoTestRunState;
  summary: string;
  targetUuid?: string;
  testRunUuid?: string;
  workflowName?: string;
  workflowSnapshot?: models.DtoWorkflow;
  workflowUuid?: string;
  workflowVersionId?: string;
}
