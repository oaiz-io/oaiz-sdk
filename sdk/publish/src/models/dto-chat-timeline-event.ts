import type * as models from "./index";

export interface DtoChatTimelineEvent {
  chatType?: models.DtoChatType | null;
  clientMessageId?: string | null;
  contextCompaction?: models.DtoChatTimelineContextCompaction | null;
  delta?: models.DtoChatTimelineMessageDelta | null;
  error?: models.DtoChatTimelineErrorPayload | null;
  message?: models.DtoChatTimelineMessage | null;
  queuePaused?: boolean | null;
  sessionId?: string | null;
  submission?: models.DtoChatSubmissionUpdate | null;
  testRunProgress?: models.DtoTestRunProgressEvent | null;
  toolApprovalInfo?: models.DtoToolApprovalRequest | null;
  toolProgress?: models.DtoChatTimelineToolProgress | null;
  type?: models.DtoChatTimelineEventType | null;
  userActionReceipt?: models.DtoUserActionReceipt | null;
  voiceDelegationResult?: models.DtoVoiceDelegationResultPayload | null;
  voiceTranscript?: models.DtoVoiceTranscriptPayload | null;
  waitsForUserInput?: boolean | null;
}
