export interface DtoJobDraft {
  actionType?: string;
  description: string;
  generatorEventIdentifier: string;
  jobGenerationPrompt: string;
  jobId: string;
  name: string;
  outputEventIdentifier?: string;
  requiredInputProperties?: string[];
  subAction?: string;
}
