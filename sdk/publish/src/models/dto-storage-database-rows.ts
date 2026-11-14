export interface DtoStorageDatabaseRows {
  count?: number;
  rows: Record<string, unknown>[] | null;
}
