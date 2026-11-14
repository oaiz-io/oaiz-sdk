import type * as models from "./index";

export interface DtoChatViewSnapshot {
  app?: models.DtoChatViewApp;
  highlightedJob?: models.DtoChatViewJob;
  jobBuilder?: models.DtoChatViewJobBuilder;
  knowledge?: models.DtoChatViewKnowledge;
  routeKey?: string;
  selectedJob?: models.DtoChatViewJob;
  testPanel?: models.DtoChatViewTestPanel;
  viewType: models.DtoChatViewType;
  workflow?: models.DtoChatViewWorkflow;
}
