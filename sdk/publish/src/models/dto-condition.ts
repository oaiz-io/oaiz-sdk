import type * as models from "./index";

export interface DtoCondition {
  expectedValue: string;
  expectedValueType: models.DtoExpectedValueType;
  field: string;
  type: models.DtoConditionType;
}
