export const DtoExecuteStreamTerminalReason = {
  AwaitingApproval: "awaiting-approval",
  AwaitingDelay: "awaiting-delay",
  Cancelled: "cancelled",
  Failure: "failure",
  RootStartFailure: "root-start-failure",
  Success: "success",
} as const;
export type DtoExecuteStreamTerminalReason = (typeof DtoExecuteStreamTerminalReason)[keyof typeof DtoExecuteStreamTerminalReason];
