import type * as models from "./index";

export interface DtoOaizChatMessage {
  clientMessageId?: string;
  id: string;
  role: models.DtoOaizChatMessageRole;
  sender: string;
  sentAt: string;
  text: string;
}
