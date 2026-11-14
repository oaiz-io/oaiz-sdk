import type * as models from "./index";

export interface DtoTestRunJobResult {
  actionExecutionLog?: models.DtoActionExecutionLog;
  actionExecutionUuid?: string;
  completedAt: string;
  error?: string;
  inputEvent?: models.DtoEventInputOutput;
  jobName: string;
  jobSnapshot?: models.DtoJob;
  jobUuid: string;
  jobVersionId?: string;
  outputEvent?: models.DtoEventInputOutput;
  startedAt: string;
  status: models.DtoTestRunStatus;
  triggered: boolean;
  workflowVersionId?: string;
}
