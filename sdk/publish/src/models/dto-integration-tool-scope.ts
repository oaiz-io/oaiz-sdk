export const DtoIntegrationToolScope = {
  All: "all",
  Selected: "selected",
} as const;
export type DtoIntegrationToolScope = (typeof DtoIntegrationToolScope)[keyof typeof DtoIntegrationToolScope];
