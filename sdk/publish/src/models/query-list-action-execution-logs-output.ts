import type * as models from "./index";

export interface QueryListActionExecutionLogsOutput {
  hasMore: boolean;
  items: models.DtoActionExecutionLogMetadata[];
  nextCursor: string | null;
  runSummaries: models.DtoActionExecutionRunSummary[] | null;
}
