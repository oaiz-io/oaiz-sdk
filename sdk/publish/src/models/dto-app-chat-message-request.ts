import type * as models from "./index";

export interface DtoAppChatMessageRequest {
  clientMessageId: string;
  content: string;
  integrationTools?: models.DtoAppChatIntegrationTool[] | null;
  model?: models.DtoLLM | null;
  nativeTools?: models.DtoAppChatNativeTool[] | null;
  providerKeyUuid?: string | null;
  sessionId?: string | null;
  systemPrompt: string;
  type?: models.DtoAppChatMessageType | null;
  voiceDelegationId?: string | null;
}
