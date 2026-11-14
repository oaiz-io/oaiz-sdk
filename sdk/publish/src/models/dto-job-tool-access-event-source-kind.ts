export const DtoJobToolAccessEventSourceKind = {
  Connection: "connection",
  Database: "database",
  EventType: "eventType",
  Workflow: "workflow",
} as const;
export type DtoJobToolAccessEventSourceKind = (typeof DtoJobToolAccessEventSourceKind)[keyof typeof DtoJobToolAccessEventSourceKind];
