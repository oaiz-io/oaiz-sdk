import type * as models from "./index";

export interface DtoCreateLLMCallResponse {
  model: models.DtoLLM;
  text: string;
  usage: models.DtoLLMCallUsageDTO;
}
