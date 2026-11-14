import type * as models from "./index";

export interface DtoGoalMeasurementFilterOutput {
  field: string;
  op: models.DtoGoalMeasurementFilterOperator;
  values?: models.DtoGoalMeasurementFilterValueOutput[];
}
