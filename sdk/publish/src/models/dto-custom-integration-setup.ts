import type * as models from "./index";

export interface DtoCustomIntegrationSetup {
  authentication: models.DtoCustomIntegrationSetupAuthentication;
  endpoint?: string;
  integrationUuid?: string;
  kind: models.DtoCustomIntegrationSourceKind;
  name: string;
}
