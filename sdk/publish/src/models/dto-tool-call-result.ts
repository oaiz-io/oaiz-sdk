export interface DtoToolCallResult {
  args?: Record<string, unknown>;
  displayName?: string;
  error?: string;
  integrationName?: string;
  integrationUuid?: string;
  provider?: string;
  result?: Record<string, unknown>;
  success: boolean;
  toolCallId: string;
  toolName: string;
}
