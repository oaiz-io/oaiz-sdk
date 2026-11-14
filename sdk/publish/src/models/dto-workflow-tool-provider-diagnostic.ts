import type * as models from "./index";

export interface DtoWorkflowToolProviderDiagnostic {
  kind: models.DtoWorkflowToolDiagnosticKind;
  reason: string;
}
