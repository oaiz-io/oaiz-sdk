import type * as models from "./index";

export interface DtoWorkflow {
  createdAt: string;
  description: string;
  edges: models.DtoWorkflowEdge[] | null;
  effectiveCapability?: models.DtoWorkflowCapability;
  jobAccountAccess?: models.DtoSavedJobAccountAccess[];
  jobs: models.DtoJob[] | null;
  name: string;
  notifyOnFailure: boolean;
  slug?: string;
  status: models.DtoStatus;
  updatedAt: string;
  uuid: string;
  versionId?: string;
}
