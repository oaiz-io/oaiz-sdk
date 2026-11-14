import type * as models from "./index";

export interface DtoJobToolAccessPartOutput {
  resources: models.DtoJobToolAccessResource[] | null;
  scope: models.DtoJobToolAccessScope;
}
