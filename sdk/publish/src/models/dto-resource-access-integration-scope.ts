import type * as models from "./index";

export interface DtoResourceAccessIntegrationScope {
  actionTypes?: string[] | null;
  eventScope?: models.DtoIntegrationEventScope | null;
  eventTypes?: string[] | null;
  namespaceScope?: models.DtoIntegrationNamespaceScope | null;
  namespaces?: models.DtoIntegrationGrantNamespace[] | null;
  toolScope?: models.DtoIntegrationToolScope | null;
}
