export const DtoStatus = {
  AiDraft: "AI-Draft",
  Draft: "Draft",
  Live: "Live",
  Paused: "Paused",
} as const;
export type DtoStatus = (typeof DtoStatus)[keyof typeof DtoStatus];
