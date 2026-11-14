import type * as models from "./index";

export interface DtoResourceAccessChangePreviewItem {
  effectiveCapability?: string | null;
  error?: models.DtoResourceAccessItemError | null;
  id: string;
  kind: models.DtoResourceAccessItemKind;
  name?: string | null;
}
