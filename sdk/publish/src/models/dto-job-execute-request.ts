import type * as models from "./index";

export interface DtoJobExecuteRequest {
  actionExecutionUuid?: string | null;
  branchId?: string | null;
  event?: models.DtoEventInputInput | null;
  executeIntegrationCommand?: boolean | null;
  executeIntegrationQuery?: boolean | null;
  publishEvents?: boolean | null;
  sourceEventUuid?: string | null;
  sourceExecutionUuid?: string | null;
}
