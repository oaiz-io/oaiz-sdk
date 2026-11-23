import type * as models from "./index";

export interface DtoChatTurnTarget {
  context: models.DtoChatMessageContextRefs;
  contextBranches?: models.DtoChatMessageContextBranch[];
  folderId?: string;
  originatingUserMessageId?: string;
  planArtifactId?: string;
  replyToMessageId?: string;
  resolvedAdmission?: models.DtoChatTurnResourceAdmission;
  viewingBranchId?: string;
  viewingVersionId?: string;
  viewingWorkflowId?: string;
}
