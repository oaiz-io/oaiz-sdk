export const DtoJobAccountAccessLevel = {
  Edit: "edit",
  View: "view",
} as const;
export type DtoJobAccountAccessLevel = (typeof DtoJobAccountAccessLevel)[keyof typeof DtoJobAccountAccessLevel];
