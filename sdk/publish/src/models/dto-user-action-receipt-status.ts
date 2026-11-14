export const DtoUserActionReceiptStatus = {
  Failed: "failed",
  Recorded: "recorded",
  Rejected: "rejected",
} as const;
export type DtoUserActionReceiptStatus = (typeof DtoUserActionReceiptStatus)[keyof typeof DtoUserActionReceiptStatus];
