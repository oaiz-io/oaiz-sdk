export const DtoChatType = {
  App: "app",
  Default: "default",
  Onboarding: "onboarding",
  Plan: "plan",
} as const;
export type DtoChatType = (typeof DtoChatType)[keyof typeof DtoChatType];
