import type * as models from "./index";

export interface DtoToolApprovalRequest {
  approvalGroup?: string | null;
  approvalMode?: models.DtoToolApprovalMode | null;
  args?: Record<string, unknown> | null;
  displayName?: string | null;
  preview?: models.DtoToolApprovalPreview | null;
  timeoutMs?: number | null;
  toolCallId?: string | null;
  toolName?: string | null;
  viewingBranchId?: string | null;
}
