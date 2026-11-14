import type * as models from "./index";

export interface DtoWorkflowToolSummary {
  actionLabel?: string;
  actionType?: string;
  configSnippet: models.DtoWorkflowToolConfigSnippet;
  description: string;
  instanceName?: string;
  integrationUuid?: string;
  kind: models.DtoWorkflowToolKind;
  name: string;
  provider?: string;
  selector: string;
}
