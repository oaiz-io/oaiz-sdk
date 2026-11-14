import type * as models from "./index";

export interface DtoWorkflowToolIntegrationDiagnostic {
  diagnostics: models.DtoWorkflowToolProviderDiagnostic[] | null;
  instanceName: string;
  integrationUuid: string;
  provider: string;
  tools: models.DtoWorkflowToolDiagnostic[] | null;
}
