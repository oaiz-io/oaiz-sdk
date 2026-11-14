import type * as models from "./index";

export interface DtoEventInputOutput {
  eventType: models.DtoEventTypeInput;
  files?: models.DtoFileReferenceInput[];
  integrationUuid?: string;
  namespaceId?: string;
  properties?: Record<string, unknown> | null;
  timestamp?: string;
  uniqueKey?: string;
  userAggregationId?: string;
  userIdentifier?: string;
}
