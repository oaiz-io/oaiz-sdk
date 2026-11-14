export const DtoExpectedValueType = {
  Bool: "bool",
  Float64: "float64",
  Int: "int",
  String: "string",
  Time: "time",
} as const;
export type DtoExpectedValueType = (typeof DtoExpectedValueType)[keyof typeof DtoExpectedValueType];
