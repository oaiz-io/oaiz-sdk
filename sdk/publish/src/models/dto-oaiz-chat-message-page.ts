import type * as models from "./index";

export interface DtoOaizChatMessagePage {
  hasMore: boolean;
  items: models.DtoOaizChatMessage[];
  latestCursor: string | null;
  nextCursor: string | null;
}
