export const DtoChatQueuePauseReason = {
  Disconnected: "disconnected",
  Failed: "failed",
  RequiredAction: "required-action",
  Stopped: "stopped",
  TurnRunning: "turn-running",
} as const;
export type DtoChatQueuePauseReason = (typeof DtoChatQueuePauseReason)[keyof typeof DtoChatQueuePauseReason];
