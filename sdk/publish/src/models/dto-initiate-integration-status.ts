export const DtoInitiateIntegrationStatus = {
  Cancelled: "cancelled",
  Connected: "connected",
  Declined: "declined",
  Failed: "failed",
  Pending: "pending",
} as const;
export type DtoInitiateIntegrationStatus = (typeof DtoInitiateIntegrationStatus)[keyof typeof DtoInitiateIntegrationStatus];
