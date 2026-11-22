import type * as models from "./index";

export interface DtoWorkflowRunRequest {
  branchId?: string | null;
  event?: models.DtoEventInputInput | null;
  executeIntegrationCommand?: boolean | null;
  executeIntegrationQuery?: boolean | null;
  jobUuid?: string | null;
  publishEvents?: boolean | null;
  runUuid?: string | null;
  sourceEventUuid?: string | null;
  sourceExecutionUuid?: string | null;
}
