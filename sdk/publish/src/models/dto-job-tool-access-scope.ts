export const DtoJobToolAccessScope = {
  Any: "any",
  Selected: "selected",
} as const;
export type DtoJobToolAccessScope = (typeof DtoJobToolAccessScope)[keyof typeof DtoJobToolAccessScope];
