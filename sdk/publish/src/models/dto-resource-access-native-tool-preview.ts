import type * as models from "./index";

export interface DtoResourceAccessNativeToolPreview {
  appId?: string | null;
  appName?: string | null;
  currentTools?: string[] | null;
  effectiveCapability?: string | null;
  error?: models.DtoResourceAccessItemError | null;
  tools?: string[] | null;
}
