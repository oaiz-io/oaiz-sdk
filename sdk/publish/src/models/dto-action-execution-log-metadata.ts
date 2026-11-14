import type * as models from "./index";

export interface DtoActionExecutionLogMetadata {
  artifactCount: number;
  completedAt?: string;
  executionDurationMs?: number;
  initiationOrigin?: models.DtoExecutionInitiationOrigin;
  jobName: string;
  jobUuid: string;
  organisationUuid: string;
  publishedEvents: models.DtoEventMinimalMetadata[] | null;
  sourceExecutionUuid?: string;
  status: models.DtoExecutionStatus;
  testRunUuid?: string;
  totalCost?: string | null;
  totalCostCurrency?: string;
  triggeredAt: string | null;
  triggeringEvent: models.DtoEventMinimalMetadata | null;
  updatedAt: string | null;
  uuid: string;
  workflowTraceId?: string;
  workflowVersionId?: string;
  workflows: models.DtoWorkflowMinimalMetadata[] | null;
}
