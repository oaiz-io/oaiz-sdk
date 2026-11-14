export const DtoTestRunProgressEventType = {
  ActionLog: "action_log",
  Error: "error",
  Finished: "finished",
  JobFinished: "job_finished",
  JobStarted: "job_started",
} as const;
export type DtoTestRunProgressEventType = (typeof DtoTestRunProgressEventType)[keyof typeof DtoTestRunProgressEventType];
