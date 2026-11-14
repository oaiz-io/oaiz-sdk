import type * as models from "./index";

export interface DtoToolMetadata {
  actionLabel?: string;
  actionType: string;
  annotations: models.DtoToolAnnotations;
  category: string;
  description: string;
  inputSchema: Record<string, unknown> | null;
  instanceName?: string;
  integrationUuid?: string;
  name: string;
  outputSchema?: Record<string, unknown>;
  provider: string;
}
