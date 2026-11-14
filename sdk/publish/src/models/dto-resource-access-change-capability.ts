export const DtoResourceAccessChangeCapability = {
  Edit: "edit",
  Owner: "owner",
  Remove: "remove",
  View: "view",
} as const;
export type DtoResourceAccessChangeCapability = (typeof DtoResourceAccessChangeCapability)[keyof typeof DtoResourceAccessChangeCapability];
