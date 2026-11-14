import type * as models from "./index";

export interface DtoChatSessionMetadata {
  chatType: models.DtoChatType;
  createdAt: string;
  id: string;
  lastMessageAt?: string;
  messageCount: number;
  status: number;
  title: string;
  workflowUuid?: string;
}
