export const DtoIntegrationNamespaceScope = {
  All: "all",
  Selected: "selected",
  Source: "source",
} as const;
export type DtoIntegrationNamespaceScope = (typeof DtoIntegrationNamespaceScope)[keyof typeof DtoIntegrationNamespaceScope];
