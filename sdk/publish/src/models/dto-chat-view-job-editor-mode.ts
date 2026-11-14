export const DtoChatViewJobEditorMode = {
  Advanced: "advanced",
  Overview: "overview",
} as const;
export type DtoChatViewJobEditorMode = (typeof DtoChatViewJobEditorMode)[keyof typeof DtoChatViewJobEditorMode];
