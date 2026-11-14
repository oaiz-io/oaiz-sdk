export const DtoGoalRollingWindowUnit = {
  Day: "day",
  Month: "month",
  Week: "week",
  Year: "year",
} as const;
export type DtoGoalRollingWindowUnit = (typeof DtoGoalRollingWindowUnit)[keyof typeof DtoGoalRollingWindowUnit];
