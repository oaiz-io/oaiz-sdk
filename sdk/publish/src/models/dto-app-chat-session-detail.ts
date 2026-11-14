import type * as models from "./index";

export interface DtoAppChatSessionDetail {
  chatType: models.DtoChatType;
  createdAt: string;
  hasActiveTurn: boolean;
  id: string;
  lastMessageAt?: string;
  messageCount: number;
  messages: models.DtoChatTimelineMessage[] | null;
  pendingApproval?: models.DtoAppChatPendingApproval;
  status: number;
  title: string;
  workflowUuid?: string;
}
