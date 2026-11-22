import type * as models from "./index";

export interface DtoAppBuildHandoff {
  clientMessageId?: string;
  status: string;
  target?: models.DtoAppDraftTarget;
  task: string;
}
