export const DtoMessageRole = {
  Ai: "ai",
  System: "system",
  User: "user",
} as const;
export type DtoMessageRole = (typeof DtoMessageRole)[keyof typeof DtoMessageRole];
