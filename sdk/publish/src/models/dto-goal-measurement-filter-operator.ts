export const DtoGoalMeasurementFilterOperator = {
  Eq: "eq",
  Exists: "exists",
  In: "in",
  NotExists: "not_exists",
} as const;
export type DtoGoalMeasurementFilterOperator = (typeof DtoGoalMeasurementFilterOperator)[keyof typeof DtoGoalMeasurementFilterOperator];
