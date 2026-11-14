export const DtoStorageRowCount = {
  Exact: "exact",
} as const;
export type DtoStorageRowCount = (typeof DtoStorageRowCount)[keyof typeof DtoStorageRowCount];
