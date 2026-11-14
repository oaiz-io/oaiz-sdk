import type * as models from "./index";

export interface DtoAccessReductionAffectedWorkflow {
  canPause: boolean;
  jobCount: number;
  name: string;
  reason: models.DtoAccessReductionReason;
  status: models.DtoStatus;
  workflowUuid: string;
}
