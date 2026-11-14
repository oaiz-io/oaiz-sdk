export const DtoConditionType = {
  ContainsStatic: "containsStatic",
  EndsWithStatic: "endsWithStatic",
  EqualStatic: "equalStatic",
  GreaterThanStatic: "greaterThanStatic",
  LessThanStatic: "lessThanStatic",
  NotContainsStatic: "notContainsStatic",
  NotEndsWithStatic: "notEndsWithStatic",
  NotEqualStatic: "notEqualStatic",
  NotStartsWithStatic: "notStartsWithStatic",
  StartsWithStatic: "startsWithStatic",
} as const;
export type DtoConditionType = (typeof DtoConditionType)[keyof typeof DtoConditionType];
