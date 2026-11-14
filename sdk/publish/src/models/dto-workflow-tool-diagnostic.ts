import type * as models from "./index";

export interface DtoWorkflowToolDiagnostic {
  actionLabel: string;
  actionType: string;
  description: string;
  kind: models.DtoWorkflowToolDiagnosticKind;
  name: string;
  reason: string;
  selector: string;
}
