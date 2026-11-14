import type * as models from "./index";

export interface DtoChatTimelineMessage {
  agentType?: string;
  artifacts?: models.DtoChatTimelineArtifact[];
  clientMessageId?: string;
  content: string;
  contextRefs?: models.DtoChatMessageContextRefs;
  createdAt: string;
  files?: models.DtoFileReference[];
  id: string;
  latencyMs?: number;
  messageType?: models.DtoMessageType;
  parentSubAgentId?: string;
  role: models.DtoMessageRole;
  savedJobWorkflowUuid?: string;
  subAgentId?: string;
  threadUuid?: string;
  uiSnapshot?: models.DtoChatViewSnapshot;
  workflowBranchId?: string;
  workflowBranchTitle?: string;
  workflowEditChanges?: models.DtoWorkflowEditChange[];
  workflowVersion?: number;
}
