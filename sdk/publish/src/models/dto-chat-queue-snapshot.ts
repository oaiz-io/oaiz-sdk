import type * as models from "./index";

export interface DtoChatQueueSnapshot {
  pauseReason?: models.DtoChatQueuePauseReason | null;
  previousTurnClientMessageId?: string | null;
  revision?: number | null;
  waiting?: models.DtoChatQueueWaitingEntry[] | null;
}
