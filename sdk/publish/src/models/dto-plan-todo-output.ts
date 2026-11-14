import type * as models from "./index";

export interface DtoPlanTodoOutput {
  artifactRefs?: string[];
  description?: string;
  error?: string;
  executionStatus?: models.DtoPlanTodoExecutionStatus;
  id: string;
  output?: string;
  status: models.DtoPlanTodoStatus;
  text: string;
}
