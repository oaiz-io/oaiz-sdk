export const DtoOaizChatMessageRole = {
  Agent: "agent",
  Person: "person",
} as const;
export type DtoOaizChatMessageRole = (typeof DtoOaizChatMessageRole)[keyof typeof DtoOaizChatMessageRole];
