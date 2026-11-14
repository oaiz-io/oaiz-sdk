export const DtoGoalTimeBucket = {
  Day: "day",
  Month: "month",
  Week: "week",
  Year: "year",
} as const;
export type DtoGoalTimeBucket = (typeof DtoGoalTimeBucket)[keyof typeof DtoGoalTimeBucket];
