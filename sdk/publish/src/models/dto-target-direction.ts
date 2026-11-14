export const DtoTargetDirection = {
  Gte: "gte",
  Lte: "lte",
} as const;
export type DtoTargetDirection = (typeof DtoTargetDirection)[keyof typeof DtoTargetDirection];
