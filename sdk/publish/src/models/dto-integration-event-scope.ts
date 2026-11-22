export const DtoIntegrationEventScope = {
  All: "all",
  None: "none",
  Selected: "selected",
} as const;
export type DtoIntegrationEventScope = (typeof DtoIntegrationEventScope)[keyof typeof DtoIntegrationEventScope];
