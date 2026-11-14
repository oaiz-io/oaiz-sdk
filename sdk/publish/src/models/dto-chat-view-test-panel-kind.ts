export const DtoChatViewTestPanelKind = {
  Current: "current",
  History: "history",
  Stored: "stored",
} as const;
export type DtoChatViewTestPanelKind = (typeof DtoChatViewTestPanelKind)[keyof typeof DtoChatViewTestPanelKind];
