export const DtoPlanTodoStatus = {
  Blocked: "blocked",
  Done: "done",
  InProgress: "in_progress",
  Pending: "pending",
} as const;
export type DtoPlanTodoStatus = (typeof DtoPlanTodoStatus)[keyof typeof DtoPlanTodoStatus];
