import type * as models from "./index";

export interface DtoActionOutput {
  config: Record<string, unknown> | null;
  outputEventConfig?: models.DtoOutputEventConfig;
  type: models.DtoActionType;
}
