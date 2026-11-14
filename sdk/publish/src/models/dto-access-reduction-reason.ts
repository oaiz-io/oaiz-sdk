export const DtoAccessReductionReason = {
  MayUseResource: "may_use_resource",
  UsesResource: "uses_resource",
} as const;
export type DtoAccessReductionReason = (typeof DtoAccessReductionReason)[keyof typeof DtoAccessReductionReason];
