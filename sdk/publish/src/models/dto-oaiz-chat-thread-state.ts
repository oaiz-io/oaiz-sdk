export const DtoOaizChatThreadState = {
  Ended: "ended",
  Idle: "idle",
  Working: "working",
} as const;
export type DtoOaizChatThreadState = (typeof DtoOaizChatThreadState)[keyof typeof DtoOaizChatThreadState];
