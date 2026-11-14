export const DtoWorkflowToolKind = {
  Integration: "integration",
  Native: "native",
} as const;
export type DtoWorkflowToolKind = (typeof DtoWorkflowToolKind)[keyof typeof DtoWorkflowToolKind];
