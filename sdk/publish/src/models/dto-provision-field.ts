import type * as models from "./index";

export interface DtoProvisionField {
  description?: string;
  id: string;
  label: string;
  permissions?: string[];
  placeholder?: string;
  required: boolean;
  sensitive: boolean;
  type: string;
  validation?: models.DtoProvisionFieldValidation;
}
