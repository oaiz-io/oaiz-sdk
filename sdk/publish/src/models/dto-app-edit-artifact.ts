export interface DtoAppEditArtifact {
  appId: string;
  appName: string;
  branchId: string;
  branchTitle: string;
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
