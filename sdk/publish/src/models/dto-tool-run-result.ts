import type * as models from "./index";

export interface DtoToolRunResult {
  fileArtifacts?: models.DtoFileReference[];
  kind: models.DtoWorkflowToolKind;
  result: Record<string, unknown> | null;
  selector: string;
  usage?: models.DtoToolUsageMetrics;
}
