import type * as models from "./index";

export interface DtoStorageRowFilter {
  and?: models.DtoStorageRowFilter[] | null;
  column?: string | null;
  not?: boolean | null;
  operator?: models.DtoStorageRowFilterOperator | null;
  or?: models.DtoStorageRowFilter[] | null;
  value?: string | null;
  values?: string[] | null;
}
