import type * as models from "./index";

export interface DtoSavedGoalResponse {
  analyticsQuery: models.DtoGoalMeasurementDefinitionOutput;
  createdAt: string;
  description: string;
  name: string;
  targetDirection?: models.DtoTargetDirection;
  targetValue?: number;
  updatedAt: string;
  uuid: string;
  workflowIds?: string[];
}
