import type * as models from "./index";

export interface DtoAppEditArtifact {
  appId: string;
  appName: string;
  availableVersion?: models.DtoAppAvailableVersion;
  branchId: string;
  branchTitle: string;
  buildHandoff?: models.DtoAppBuildHandoff;
  changedOutsideTools?: string[];
  changedPaths?: string[];
  conflict?: boolean;
  createdApp?: boolean;
  createdDraft?: boolean;
  dependencyChanged?: boolean;
  parentVersionId?: string;
  versionId?: string;
  versionNumber?: number;
}
