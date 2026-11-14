import type * as models from "./index";

export interface DtoKnowledgeContextDTOOutput {
  inheritFromWorkflow: boolean;
  knowledgeRefs: models.DtoKnowledgeReferenceDTO[] | null;
}
