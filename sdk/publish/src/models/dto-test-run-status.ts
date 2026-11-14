export const DtoTestRunStatus = {
  Errored: "errored",
  Failed: "failed",
  Passed: "passed",
} as const;
export type DtoTestRunStatus = (typeof DtoTestRunStatus)[keyof typeof DtoTestRunStatus];
