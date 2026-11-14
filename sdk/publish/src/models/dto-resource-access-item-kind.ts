export const DtoResourceAccessItemKind = {
  App: "app",
  Database: "database",
  EventType: "eventType",
  Folder: "folder",
  Integration: "integration",
  Knowledge: "knowledge",
  Workflow: "workflow",
} as const;
export type DtoResourceAccessItemKind = (typeof DtoResourceAccessItemKind)[keyof typeof DtoResourceAccessItemKind];
