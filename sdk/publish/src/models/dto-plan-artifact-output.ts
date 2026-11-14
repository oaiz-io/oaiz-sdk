import type * as models from "./index";

export interface DtoPlanArtifactOutput {
  allowedExecutionTools?: models.DtoRequestToolAccessToolInput[];
  artifactId?: string;
  currentTodoId?: string;
  executionRunId?: string;
  executionStatus?: models.DtoPlanExecutionStatus;
  markdown: string;
  title: string;
  todos?: models.DtoPlanTodoOutput[];
  toolAccessRequests?: models.DtoRequestToolAccessToolInput[];
  updatedAt: string;
}
