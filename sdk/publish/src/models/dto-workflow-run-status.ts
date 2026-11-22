export const DtoWorkflowRunStatus = {
  AwaitingApproval: "awaiting-approval",
  AwaitingDelay: "awaiting-delay",
  Failure: "failure",
  NotTriggered: "not-triggered",
  Running: "running",
  Success: "success",
} as const;
export type DtoWorkflowRunStatus = (typeof DtoWorkflowRunStatus)[keyof typeof DtoWorkflowRunStatus];
