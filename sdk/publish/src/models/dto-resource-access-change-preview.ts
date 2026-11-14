import type * as models from "./index";

export interface DtoResourceAccessChangePreview {
  changes?: models.DtoResourceAccessChangePreviewChange[] | null;
  items: models.DtoResourceAccessChangePreviewItem[];
  nativeToolChanges?: models.DtoResourceAccessNativeToolPreview[] | null;
}
