import type * as models from "./index";

export interface DtoChatTimelineArtifact {
  appEdit?: models.DtoAppEditArtifact;
  artifactType: string;
  autoApplied?: boolean;
  files?: models.DtoFileReference[];
  goal?: models.DtoSavedGoalResponse;
  id?: string;
  initiateIntegration?: models.DtoInitiateIntegrationRequest;
  jobConfig?: models.DtoJobBaseOutput;
  jobConfigFull?: models.DtoJob;
  knowledge?: models.DtoGeneratedKnowledgeArtifact;
  knowledgeEdit?: models.DtoEditedKnowledgeArtifact;
  navigateUser?: boolean;
  plan?: models.DtoPlanArtifactOutput;
  savedEntityUuid?: string;
  testResult?: models.DtoTestRunResult;
  toolAccessRequest?: models.DtoToolAccessRequest;
  toolCallResult?: models.DtoToolCallResult;
  workflow?: models.DtoWorkflowArtifact;
  workflowDraft?: models.DtoWorkflowDraft;
}
