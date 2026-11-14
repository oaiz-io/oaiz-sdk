export const DtoExecutionStatus = {
  AwaitingApproval: "awaiting-approval",
  AwaitingDelay: "awaiting-delay",
  AwaitingEvent: "awaiting-event",
  BudgetExceeded: "budget-exceeded",
  Executing: "executing",
  Failure: "failure",
  NotExecuted: "not-executed",
  Rejected: "rejected",
  Success: "success",
  Timeout: "timeout",
} as const;
export type DtoExecutionStatus = (typeof DtoExecutionStatus)[keyof typeof DtoExecutionStatus];
