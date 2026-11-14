export const DtoExecuteProgressEventType = {
  ActionLog: "action_log",
  ExecutionSnapshot: "execution_snapshot",
  RootStart: "root_start",
  Terminal: "terminal",
  Waiting: "waiting",
} as const;
export type DtoExecuteProgressEventType = (typeof DtoExecuteProgressEventType)[keyof typeof DtoExecuteProgressEventType];
