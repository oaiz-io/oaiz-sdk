import type * as models from "./index";

export interface DtoCreateLLMCallRequest {
  input: string;
  model: models.DtoLLM;
  providerKeyUuid?: string | null;
  system?: string | null;
}
