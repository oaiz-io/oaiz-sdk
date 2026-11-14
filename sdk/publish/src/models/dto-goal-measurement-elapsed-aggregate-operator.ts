export const DtoGoalMeasurementElapsedAggregateOperator = {
  Avg: "avg",
  Max: "max",
  Min: "min",
  Percentile: "percentile",
} as const;
export type DtoGoalMeasurementElapsedAggregateOperator = (typeof DtoGoalMeasurementElapsedAggregateOperator)[keyof typeof DtoGoalMeasurementElapsedAggregateOperator];
