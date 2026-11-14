import type * as models from "./index";

export interface DtoUserActionReceipt {
  clientMessageId?: string | null;
  code?: string | null;
  messageId?: string | null;
  sessionId?: string | null;
  status?: models.DtoUserActionReceiptStatus | null;
}
