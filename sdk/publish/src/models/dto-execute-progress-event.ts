import type * as models from "./index";

export interface DtoExecuteProgressEvent {
  actionExecutionLogUuid?: string;
  actionLog?: models.DtoActionLogOutput;
  executionLog?: models.DtoActionExecutionLog;
  jobUuid?: string;
  message?: string;
  occurredAt?: string;
  pendingChildJobUuids?: string[];
  publishedEvents?: models.DtoEventMinimalMetadata[];
  rootJobUuid: string;
  sequence?: number;
  slug?: string;
  status?: models.DtoExecutionStatus;
  terminalReason?: models.DtoExecuteStreamTerminalReason;
  triggered?: boolean;
  type: models.DtoExecuteProgressEventType;
  workflowTraceId?: string;
}
