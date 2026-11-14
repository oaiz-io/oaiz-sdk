import type * as models from "./index";

export interface DtoChatSessionListOutput {
  hasMore: boolean;
  items: models.DtoChatSessionMetadata[];
  nextCursor: string | null;
}
