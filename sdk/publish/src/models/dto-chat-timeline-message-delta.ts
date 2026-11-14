export interface DtoChatTimelineMessageDelta {
  content?: string | null;
  isFinal?: boolean | null;
  latencyMs?: number | null;
  messageId?: string | null;
  seq?: number | null;
  subAgentId?: string | null;
  targetType?: string | null;
  threadUuid?: string | null;
}
