import type * as models from "./index";

export interface DtoWorkflowRunEvent {
  event?: models.DtoEvent;
  executionUuid: string;
  final: boolean;
  identifier: string;
  jobUuid: string;
  pending: boolean;
  uuid: string;
}
