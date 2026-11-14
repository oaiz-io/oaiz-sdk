import type * as models from "./index";

export interface DtoToolAccessRequest {
  actionType?: string;
  approvalGroup?: string;
  displayName: string;
  integrationUuid?: string;
  provider?: string;
  reason: string;
  status?: models.DtoToolAccessRequestStatus;
  toolCallId: string;
  toolKey: string;
  toolType: string;
}
