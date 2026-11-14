import type * as models from "./index";

export interface DtoSavedJobAccountAccess {
  accountUuid: string;
  blockedNeeds: boolean;
  branchId?: string;
  jobName: string;
  jobUuid: string;
  needsAccess: boolean;
  reasons?: models.DtoJobAccountAccessNeedReason[];
  workflowUuid: string;
}
