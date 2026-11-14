import type * as models from "./index";

export interface DtoJobToolAccessEventsOutput {
  scope: models.DtoJobToolAccessScope;
  sources: models.DtoJobToolAccessEventSource[] | null;
}
