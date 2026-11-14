export const DtoChatViewJobSection = {
  Action: "action",
  General: "general",
  OutputEvent: "outputEvent",
  Trigger: "trigger",
} as const;
export type DtoChatViewJobSection = (typeof DtoChatViewJobSection)[keyof typeof DtoChatViewJobSection];
