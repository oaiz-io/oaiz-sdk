import type * as models from "./index";

export interface DtoSelectStorageDatabaseRowsInput {
  count?: models.DtoStorageRowCount | null;
  filters?: models.DtoStorageRowFilter[] | null;
  limit?: number | null;
  offset?: number | null;
  order?: models.DtoStorageRowOrder[] | null;
  select?: string | null;
  single?: boolean | null;
  table: string;
}
