import type * as models from "./index";

export interface DtoActionExecutionRunJobSummary {
  emittedOutput: boolean;
  jobUuid: string;
  status: models.DtoExecutionStatus;
}
