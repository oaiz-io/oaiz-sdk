import type * as models from "./index";

export interface DtoResourceAccessIntegrationScope {
  actionTypes?: string[] | null;
  namespaceScope?: models.DtoIntegrationNamespaceScope | null;
  namespaces?: models.DtoIntegrationGrantNamespace[] | null;
  toolScope?: models.DtoIntegrationToolScope | null;
}
