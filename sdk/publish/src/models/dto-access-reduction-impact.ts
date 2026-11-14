import type * as models from "./index";

export interface DtoAccessReductionImpact {
  accessRevision: number;
  fingerprint: string;
  incompleteProtection: boolean;
  workflows: models.DtoAccessReductionAffectedWorkflow[];
}
