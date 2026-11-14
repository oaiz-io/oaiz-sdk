export const DtoToolAccessRequestStatus = {
  Cancelled: "cancelled",
  Denied: "denied",
  Failed: "failed",
  Granted: "granted",
  Pending: "pending",
} as const;
export type DtoToolAccessRequestStatus = (typeof DtoToolAccessRequestStatus)[keyof typeof DtoToolAccessRequestStatus];
