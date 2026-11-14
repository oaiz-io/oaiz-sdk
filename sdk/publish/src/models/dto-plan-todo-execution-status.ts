export const DtoPlanTodoExecutionStatus = {
  Completed: "completed",
  Failed: "failed",
  Pending: "pending",
  Running: "running",
  WaitingForUser: "waiting_for_user",
} as const;
export type DtoPlanTodoExecutionStatus = (typeof DtoPlanTodoExecutionStatus)[keyof typeof DtoPlanTodoExecutionStatus];
