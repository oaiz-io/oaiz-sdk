import type * as models from "./index";

export interface DtoInitiateIntegrationRequest {
  failureReason?: string;
  integrationUuid?: string;
  isAppInstall: boolean;
  name: string;
  originatingPlanArtifactId?: string;
  prompt: string;
  provider: string;
  providerMetadata: models.DtoInitiateIntegrationProviderMetadata;
  provisionSchema?: models.DtoProvisionSchema;
  status?: models.DtoInitiateIntegrationStatus;
  supportsOauth: boolean;
  toolCallId: string;
}
