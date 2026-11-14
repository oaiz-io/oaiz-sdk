export interface DtoWorkflowEditChange {
  after?: Record<string, unknown>;
  before?: Record<string, unknown>;
  changedFields?: string[];
  jobName: string;
  jobUuid: string;
  operation: string;
}
