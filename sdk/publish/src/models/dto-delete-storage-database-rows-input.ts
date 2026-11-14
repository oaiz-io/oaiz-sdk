import type * as models from "./index";

export interface DtoDeleteStorageDatabaseRowsInput {
  count?: models.DtoStorageRowCount | null;
  filters: models.DtoStorageRowFilter[];
  select?: string | null;
  single?: boolean | null;
  table: string;
}
