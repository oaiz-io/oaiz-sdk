import type * as models from "./index";

export interface DtoKnowledgeContextDTOOutput {
  folderRefs?: models.DtoFolderReferenceDTO[];
  inheritFromWorkflow: boolean;
  knowledgeRefs: models.DtoKnowledgeReferenceDTO[] | null;
}
