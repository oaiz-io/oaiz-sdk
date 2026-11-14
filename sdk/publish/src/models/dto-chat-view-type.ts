export const DtoChatViewType = {
  AppCanvas: "appCanvas",
  Chat: "chat",
  JobEditor: "jobEditor",
  Knowledge: "knowledge",
  Other: "other",
  WorkflowCanvas: "workflowCanvas",
  WorkflowGoals: "workflowGoals",
  WorkflowLogs: "workflowLogs",
} as const;
export type DtoChatViewType = (typeof DtoChatViewType)[keyof typeof DtoChatViewType];
