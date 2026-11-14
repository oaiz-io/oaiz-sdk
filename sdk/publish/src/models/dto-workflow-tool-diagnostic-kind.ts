export const DtoWorkflowToolDiagnosticKind = {
  InvalidProvider: "invalid-provider",
  KeyCollision: "key-collision",
  ProviderUnavailable: "provider-unavailable",
  SchemaUnavailable: "schema-unavailable",
} as const;
export type DtoWorkflowToolDiagnosticKind = (typeof DtoWorkflowToolDiagnosticKind)[keyof typeof DtoWorkflowToolDiagnosticKind];
