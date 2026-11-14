import type * as models from "./index";

export interface DtoGoalMeasurementCorrelatedSideOutput {
  eventType: string;
  filters?: models.DtoGoalMeasurementFilterOutput[];
  joinKey: string;
}
