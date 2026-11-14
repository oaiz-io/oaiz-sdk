export interface DtoToolRunRequest {
  arguments: Record<string, unknown>;
  executeIntegrationCommand: boolean;
  executeIntegrationQuery: boolean;
}
