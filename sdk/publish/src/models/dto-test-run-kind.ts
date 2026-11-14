export const DtoTestRunKind = {
  Job: "job",
  Workflow: "workflow",
} as const;
export type DtoTestRunKind = (typeof DtoTestRunKind)[keyof typeof DtoTestRunKind];
