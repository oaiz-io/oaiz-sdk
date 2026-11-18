import type * as models from "./index";

export interface DtoJobToolAccessOutput {
  approvedIntegrationTools?: models.DtoIntegrationToolDTO[];
  approvedNativeTools?: models.DtoTools[];
  databases?: models.DtoJobToolAccessPartOutput;
  documents?: models.DtoJobToolAccessPartOutput;
  events?: models.DtoJobToolAccessEventsOutput;
  excludedIntegrationTools?: models.DtoIntegrationToolDTO[];
}
