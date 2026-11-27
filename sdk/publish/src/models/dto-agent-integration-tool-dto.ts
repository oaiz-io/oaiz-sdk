export interface DtoAgentIntegrationToolDTO {
  actionType: string;
  fixedParameters?: Record<string, unknown>;
  integrationUuid: string;
}
