import type * as models from "./index";

export interface DtoTestRunProgressEvent {
  actionExecutionLogUuid?: string;
  actionLog?: models.DtoActionLogOutput;
  branchId?: string;
  inputEvent?: models.DtoEventInputOutput;
  jobName?: string;
  jobResult?: models.DtoTestRunJobResult;
  jobUuid?: string;
  message?: string;
  result?: models.DtoTestRunResult;
  slug?: string;
  testRunUuid?: string;
  type: models.DtoTestRunProgressEventType;
  workflowUuid?: string;
}
