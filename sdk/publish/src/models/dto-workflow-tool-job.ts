export const DtoWorkflowToolJob = {
  Agent: "agent",
  Code: "code",
} as const;
export type DtoWorkflowToolJob = (typeof DtoWorkflowToolJob)[keyof typeof DtoWorkflowToolJob];
