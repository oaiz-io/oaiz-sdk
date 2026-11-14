import type * as models from "./index";

export interface DtoGoalMeasurementDefinitionOutput {
  kind: models.DtoGoalMeasurementDefinitionKind;
  metric: models.DtoGoalMeasurementMetricOutput;
  rollingWindow: models.DtoGoalRollingWindow;
  schemaVersion: number;
  timeBucket: models.DtoGoalTimeBucket;
}
