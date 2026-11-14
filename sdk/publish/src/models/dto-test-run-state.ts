export const DtoTestRunState = {
  Cancelled: "cancelled",
  Completed: "completed",
  Running: "running",
} as const;
export type DtoTestRunState = (typeof DtoTestRunState)[keyof typeof DtoTestRunState];
