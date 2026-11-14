import type * as models from "./index";

export interface DtoChatViewJobBuilder {
  branch?: models.DtoChatViewLabel;
  branchId?: string;
  editorMode: models.DtoChatViewJobEditorMode;
  jobId?: string;
  label?: models.DtoChatViewLabel;
  mode: models.DtoChatViewJobBuilderMode;
  openSections?: models.DtoChatViewJobSection[];
  versionId?: string;
}
