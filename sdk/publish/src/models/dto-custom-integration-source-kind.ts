export const DtoCustomIntegrationSourceKind = {
  Http: "http",
  Mcp: "mcp",
} as const;
export type DtoCustomIntegrationSourceKind = (typeof DtoCustomIntegrationSourceKind)[keyof typeof DtoCustomIntegrationSourceKind];
