import type * as models from "./index";

export interface DtoRequestToolAccessToolInput {
  reason: string;
  toolKey: string;
  toolType: models.DtoRequestToolAccessToolType;
}
