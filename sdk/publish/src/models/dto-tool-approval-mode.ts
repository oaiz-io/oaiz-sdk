export const DtoToolApprovalMode = {
  AutoAccept: "auto_accept",
  RequireApproval: "require_approval",
  RequireApprovalAutoAccept: "require_approval_auto_accept",
} as const;
export type DtoToolApprovalMode = (typeof DtoToolApprovalMode)[keyof typeof DtoToolApprovalMode];
