export const DtoChatViewResolution = {
  Resolved: "resolved",
  Unavailable: "unavailable",
} as const;
export type DtoChatViewResolution = (typeof DtoChatViewResolution)[keyof typeof DtoChatViewResolution];
