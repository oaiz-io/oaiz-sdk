export const DtoWorkflowCapability = {
  Edit: "edit",
  Owner: "owner",
  View: "view",
} as const;
export type DtoWorkflowCapability = (typeof DtoWorkflowCapability)[keyof typeof DtoWorkflowCapability];
