import type * as models from "./index";

export interface DtoAppUserPage {
  hasMore: boolean;
  items: models.DtoAppUser[];
  nextCursor: string | null;
}
