import type * as models from "./index";

export interface DtoEditedKnowledgeArtifact {
  body: models.DtoKnowledgeVersionBodyOutput | null;
  mediaRefs?: models.DtoKnowledgeImageReferenceInputOutput[];
  originalBranchId: string;
  originalKnowledgeId: string;
  originalVersionId: string;
  title: string;
}
