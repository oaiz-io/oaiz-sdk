import type * as models from "./index";

export interface DtoJob {
  action: models.DtoActionOutput;
  description: string;
  generator?: models.DtoGeneratorOutput;
  jobAccountAccess?: models.DtoSavedJobAccountAccess[];
  knowledgeContext?: models.DtoKnowledgeContextDTOOutput;
  name: string;
  notifyOnFailure?: boolean;
  status: models.DtoStatus;
  timeout: number;
  toolAccess?: models.DtoJobToolAccessOutput;
  trigger?: models.DtoTriggerOutput;
  uuid: string;
  versionId?: string;
}
