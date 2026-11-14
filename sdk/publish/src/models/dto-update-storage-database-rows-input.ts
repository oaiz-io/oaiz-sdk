import type * as models from "./index";

export interface DtoUpdateStorageDatabaseRowsInput {
  count?: models.DtoStorageRowCount | null;
  filters: models.DtoStorageRowFilter[];
  select?: string | null;
  single?: boolean | null;
  table: string;
  values: Record<string, unknown>;
}
