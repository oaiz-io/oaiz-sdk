import type * as models from "./index";

export interface DtoWorkflowToolConfigSnippet {
  allowedIntegrations?: models.DtoWorkflowToolIntegrationRef[];
  allowedTools?: string[];
  integrationTools?: models.DtoIntegrationToolDTO[];
  publishEventTypes?: models.DtoPublishEventTypeDTO[];
  storageTools?: models.DtoStorageToolDTO[];
  tools?: models.DtoTools[];
}
