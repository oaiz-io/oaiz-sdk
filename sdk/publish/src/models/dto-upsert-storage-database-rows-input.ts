import type * as models from "./index";

export interface DtoUpsertStorageDatabaseRowsInput {
  count?: models.DtoStorageRowCount | null;
  defaultToNull?: boolean | null;
  ignoreDuplicates?: boolean | null;
  onConflict?: string[] | null;
  rows: Record<string, unknown>[];
  select?: string | null;
  single?: boolean | null;
  table: string;
}
