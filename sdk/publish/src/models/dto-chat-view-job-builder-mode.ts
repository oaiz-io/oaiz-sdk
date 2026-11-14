export const DtoChatViewJobBuilderMode = {
  Create: "create",
  Edit: "edit",
  View: "view",
} as const;
export type DtoChatViewJobBuilderMode = (typeof DtoChatViewJobBuilderMode)[keyof typeof DtoChatViewJobBuilderMode];
