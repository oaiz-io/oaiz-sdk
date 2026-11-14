import type * as models from "./index";

export interface DtoInsertStorageDatabaseRowsInput {
  count?: models.DtoStorageRowCount | null;
  defaultToNull?: boolean | null;
  rows: Record<string, unknown>[];
  select?: string | null;
  single?: boolean | null;
  table: string;
}
