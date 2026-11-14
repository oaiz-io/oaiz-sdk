export const DtoGoalMeasurementDefinitionKind = {
  GoalMeasurementDefinition: "GoalMeasurementDefinition",
} as const;
export type DtoGoalMeasurementDefinitionKind = (typeof DtoGoalMeasurementDefinitionKind)[keyof typeof DtoGoalMeasurementDefinitionKind];
