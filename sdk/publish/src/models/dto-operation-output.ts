import type * as models from "./index";

export interface DtoOperationOutput {
  conditions?: models.DtoCondition[];
  operations?: models.DtoOperationOutput[];
  type: "and" | "or";
}
