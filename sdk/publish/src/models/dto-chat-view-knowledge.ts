import type * as models from "./index";

export interface DtoChatViewKnowledge {
  branch?: models.DtoChatViewLabel;
  branchId?: string;
  documentId: string;
  label: models.DtoChatViewLabel;
  versionId?: string;
}
