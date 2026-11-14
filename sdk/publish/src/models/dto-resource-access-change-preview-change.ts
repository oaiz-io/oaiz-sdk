import type * as models from "./index";

export interface DtoResourceAccessChangePreviewChange {
  capability?: models.DtoResourceAccessChangeCapability | null;
  currentCapability?: string | null;
  currentIntegrationScope?: models.DtoResourceAccessIntegrationScope | null;
  currentNamespaceScope?: models.DtoIntegrationNamespaceScope | null;
  currentNamespaces?: models.DtoIntegrationGrantNamespace[] | null;
  impact?: models.DtoAccessReductionImpact | null;
  impactError?: models.DtoResourceAccessItemError | null;
  itemId: string;
  itemKind: models.DtoResourceAccessItemKind;
  namespaceScope?: models.DtoIntegrationNamespaceScope | null;
  namespaces?: models.DtoIntegrationGrantNamespace[] | null;
  proposedIntegrationScope?: models.DtoResourceAccessIntegrationScope | null;
  subjectId: string;
  subjectKind: models.DtoResourceAccessChangeSubjectKind;
  subjectName?: string | null;
}
