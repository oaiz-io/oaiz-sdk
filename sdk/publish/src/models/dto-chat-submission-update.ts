import type * as models from "./index";

export interface DtoChatSubmissionUpdate {
  clientMessageId?: string | null;
  code?: string | null;
  content?: string | null;
  messageId?: string | null;
  status?: models.DtoChatSubmissionStatus | null;
}
