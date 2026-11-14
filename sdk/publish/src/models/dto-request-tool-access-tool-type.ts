export const DtoRequestToolAccessToolType = {
  Integration: "integration",
  Native: "native",
} as const;
export type DtoRequestToolAccessToolType = (typeof DtoRequestToolAccessToolType)[keyof typeof DtoRequestToolAccessToolType];
