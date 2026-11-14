import type * as models from "./index";

export interface DtoJobBaseOutput {
  action: models.DtoActionOutput;
  description: string;
  generator?: models.DtoGeneratorOutput;
  knowledgeContext?: models.DtoKnowledgeContextDTOOutput;
  name: string;
  notifyOnFailure?: boolean;
  status: models.DtoStatus;
  timeout: number;
  toolAccess?: models.DtoJobToolAccessOutput;
  trigger?: models.DtoTriggerOutput;
}
