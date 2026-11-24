import type * as models from "./index";

export interface DtoChatTurnTarget {
  context: models.DtoChatMessageContextRefs;
  contextBranches?: models.DtoChatMessageContextBranch[];
  contextProvenance?: models.DtoChatContextProvenance;
  folderId?: string;
  originatingUserMessageId?: string;
  planArtifactId?: string;
  recoveredContext?: models.DtoChatTurnRecoveredContext;
  replyToMessageId?: string;
  resolvedAdmission?: models.DtoChatTurnResourceAdmission;
  viewingBranchId?: string;
  viewingVersionId?: string;
  viewingWorkflowId?: string;
}
