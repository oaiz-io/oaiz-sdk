export const DtoCustomIntegrationSetupAuthenticationType = {
  ApiKey: "apiKey",
  Bearer: "bearer",
  None: "none",
} as const;
export type DtoCustomIntegrationSetupAuthenticationType = (typeof DtoCustomIntegrationSetupAuthenticationType)[keyof typeof DtoCustomIntegrationSetupAuthenticationType];
