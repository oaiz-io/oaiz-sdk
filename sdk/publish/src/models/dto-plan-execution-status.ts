export const DtoPlanExecutionStatus = {
  Abandoned: "abandoned",
  Completed: "completed",
  Failed: "failed",
  Pending: "pending",
  Running: "running",
  WaitingForUser: "waiting_for_user",
} as const;
export type DtoPlanExecutionStatus = (typeof DtoPlanExecutionStatus)[keyof typeof DtoPlanExecutionStatus];
