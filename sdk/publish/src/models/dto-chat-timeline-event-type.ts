export const DtoChatTimelineEventType = {
  ContextCompaction: "context.compaction",
  Error: "error",
  GenerationCancelled: "generation.cancelled",
  GenerationFinished: "generation.finished",
  GenerationStarted: "generation.started",
  MessageCreated: "message.created",
  MessageDelta: "message.delta",
  MessageUpdated: "message.updated",
  SessionCreated: "session.created",
  TestRunProgress: "testRun.progress",
  TokenRefreshRequired: "token.refreshRequired",
  ToolApprovalRequired: "tool.approvalRequired",
  ToolProgress: "tool.progress",
  UserActionReceipt: "userAction.receipt",
  VoiceDelegationResult: "voice.delegationResult",
  VoiceTranscript: "voice.transcript",
} as const;
export type DtoChatTimelineEventType = (typeof DtoChatTimelineEventType)[keyof typeof DtoChatTimelineEventType];
