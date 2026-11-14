import type * as models from "./index";

export interface DtoActionExecutionLog {
  artifacts?: models.DtoFileReference[];
  awaitEventDetails?: models.DtoAwaitEventDetails;
  completedAt?: string;
  executionDurationMs?: number;
  initiationOrigin?: models.DtoExecutionInitiationOrigin;
  jobName?: string;
  jobSnapshot?: models.DtoJob;
  jobUuid: string;
  jobVersionId?: string;
  llmCalls?: models.DtoActionExecutionLLMCall[];
  logs: models.DtoActionLogOutput[] | null;
  organisationUuid: string;
  publishedEventUuids?: string[];
  publishedEvents?: models.DtoEventMinimalMetadata[];
  sourceExecutionUuid?: string;
  status: models.DtoExecutionStatus;
  testRunUuid?: string;
  toolCalls?: models.DtoActionExecutionToolCall[];
  triggeredAt?: string;
  triggeringEventUuid?: string;
  updatedAt?: string;
  uuid: string;
  workflowTraceId?: string;
  workflowUuid?: string;
  workflowVersionId?: string;
}
