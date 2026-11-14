export const DtoJobAccountAccessNeedReason = {
  RiskyCombination: "risky-combination",
} as const;
export type DtoJobAccountAccessNeedReason = (typeof DtoJobAccountAccessNeedReason)[keyof typeof DtoJobAccountAccessNeedReason];
