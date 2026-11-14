import type * as models from "./index";

export interface DtoChatViewWorkflow {
  branch?: models.DtoChatViewLabel;
  branchId?: string;
  label: models.DtoChatViewLabel;
  versionId?: string;
  workflowId: string;
}
