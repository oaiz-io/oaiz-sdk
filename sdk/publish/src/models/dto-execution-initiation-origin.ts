export const DtoExecutionInitiationOrigin = {
  Manual: "manual",
  Test: "test",
  Triggered: "triggered",
} as const;
export type DtoExecutionInitiationOrigin = (typeof DtoExecutionInitiationOrigin)[keyof typeof DtoExecutionInitiationOrigin];
