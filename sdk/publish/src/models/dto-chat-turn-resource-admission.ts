import type * as models from "./index";

export interface DtoChatTurnResourceAdmission {
  contextBranches: models.DtoChatMessageContextBranch[] | null;
  resources: models.DtoChatMessageContextRefs;
  retiredBranchIds: string[] | null;
  workflowJobs: models.DtoChatTurnWorkflowJobs[] | null;
}
