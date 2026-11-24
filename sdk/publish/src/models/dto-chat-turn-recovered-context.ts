import type * as models from "./index";

export interface DtoChatTurnRecoveredContext {
  context: models.DtoChatMessageContextRefs;
  contextBranches?: models.DtoChatMessageContextBranch[];
}
