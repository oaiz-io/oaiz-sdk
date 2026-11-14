import type * as models from "./index";

export interface DtoWorkflowArtifact {
  description: string;
  fixPropertyFlowInWorkflow?: boolean;
  jobCount?: number;
  jobs?: models.DtoJobBaseOutput[];
  name: string;
  notifyOnFailure?: boolean;
  status?: models.DtoStatus;
  workflowUuid?: string;
}
