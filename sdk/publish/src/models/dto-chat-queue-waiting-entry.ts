export interface DtoChatQueueWaitingEntry {
  clientMessageId?: string | null;
  content?: string | null;
  fileCount?: number | null;
  steerable?: boolean | null;
  targetClientMessageId?: string | null;
}
