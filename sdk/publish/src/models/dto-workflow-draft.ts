import type * as models from "./index";

export interface DtoWorkflowDraft {
  description: string;
  jobs: models.DtoJobDraft[] | null;
  name: string;
}
