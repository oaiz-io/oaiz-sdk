import type * as models from "./index";

export interface DtoAppChatApprovalRequest {
  approved: boolean;
  integrationTools?: models.DtoAppChatIntegrationTool[] | null;
  model?: models.DtoLLM | null;
  nativeTools?: models.DtoAppChatNativeTool[] | null;
  providerKeyUuid?: string | null;
  systemPrompt: string;
}
