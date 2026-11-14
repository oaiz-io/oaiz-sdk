export const DtoAwaitEventDeadlineBehavior = {
  ContinueExpired: "continueExpired",
  Fail: "fail",
} as const;
export type DtoAwaitEventDeadlineBehavior = (typeof DtoAwaitEventDeadlineBehavior)[keyof typeof DtoAwaitEventDeadlineBehavior];
