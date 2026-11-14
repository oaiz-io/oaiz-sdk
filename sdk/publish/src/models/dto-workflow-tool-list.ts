import type * as models from "./index";

export interface DtoWorkflowToolList {
  integrationDiagnostics: models.DtoWorkflowToolIntegrationDiagnostic[] | null;
  items: models.DtoWorkflowToolSummary[];
  job: models.DtoWorkflowToolJob;
}
