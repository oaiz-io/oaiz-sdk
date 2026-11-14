export const DtoIntegrationNamespaceLevel = {
  Edit: "edit",
  View: "view",
} as const;
export type DtoIntegrationNamespaceLevel = (typeof DtoIntegrationNamespaceLevel)[keyof typeof DtoIntegrationNamespaceLevel];
