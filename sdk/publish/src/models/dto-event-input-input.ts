import type * as models from "./index";

export interface DtoEventInputInput {
  eventType: models.DtoEventTypeInput | null;
  files?: models.DtoFileReferenceInput[] | null;
  integrationUuid?: string | null;
  namespaceId?: string | null;
  properties?: Record<string, unknown> | null;
  timestamp?: string | null;
  uniqueKey?: string | null;
  userAggregationId?: string | null;
  userIdentifier?: string | null;
}
