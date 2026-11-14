export const DtoStorageRowFilterOperator = {
  Eq: "eq",
  Gt: "gt",
  Gte: "gte",
  Ilike: "ilike",
  In: "in",
  Is: "is",
  Like: "like",
  Lt: "lt",
  Lte: "lte",
  Neq: "neq",
} as const;
export type DtoStorageRowFilterOperator = (typeof DtoStorageRowFilterOperator)[keyof typeof DtoStorageRowFilterOperator];
