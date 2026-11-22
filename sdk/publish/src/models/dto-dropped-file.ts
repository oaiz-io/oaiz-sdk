import type * as models from "./index";

export interface DtoDroppedFile {
  contentType?: string;
  filename: string;
  message: string;
  reason: models.DtoDroppedFileReason;
  size?: number;
}
