import type * as models from "./index";

export interface DtoGoalMeasurementMetricOutput {
  aggregate?: models.DtoGoalMeasurementElapsedAggregateOutput;
  denominator?: models.DtoGoalMeasurementPopulationOutput;
  eventType?: string;
  filters?: models.DtoGoalMeasurementFilterOutput[];
  from?: models.DtoGoalMeasurementCorrelatedSideOutput;
  kind: models.DtoGoalMeasurementMetricKind;
  numerator?: models.DtoGoalMeasurementPopulationOutput;
  to?: models.DtoGoalMeasurementCorrelatedSideOutput;
}
