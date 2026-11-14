export const DtoGoalMeasurementMetricKind = {
  CorrelatedEventCount: "correlatedEventCount",
  ElapsedTime: "elapsedTime",
  EventCount: "eventCount",
  EventRatio: "eventRatio",
} as const;
export type DtoGoalMeasurementMetricKind = (typeof DtoGoalMeasurementMetricKind)[keyof typeof DtoGoalMeasurementMetricKind];
