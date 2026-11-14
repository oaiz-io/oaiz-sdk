export const DtoAppChatMessageType = {
  VoiceDelegation: "voice_delegation",
} as const;
export type DtoAppChatMessageType = (typeof DtoAppChatMessageType)[keyof typeof DtoAppChatMessageType];
