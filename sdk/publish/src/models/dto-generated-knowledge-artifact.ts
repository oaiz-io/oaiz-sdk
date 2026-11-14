import type * as models from "./index";

export interface DtoGeneratedKnowledgeArtifact {
  body: models.DtoKnowledgeVersionBodyOutput | null;
  folderId?: string;
  mediaRefs?: models.DtoKnowledgeImageReferenceInputOutput[];
  title: string;
}
