import type * as models from "./index";

export interface DtoEvent {
  droppedFiles?: models.DtoDroppedFile[];
  eventTypeIdentifier: string;
  files?: models.DtoFileReference[];
  hasFiles: boolean;
  integrationUuid?: string;
  namespaceId?: string;
  organisationUuid: string;
  properties: Record<string, unknown> | null;
  timestamp: string;
  uniqueKey?: string;
  userAggregationId?: string;
  userIdentifier?: string;
  userUuid?: string;
  uuid: string;
}
