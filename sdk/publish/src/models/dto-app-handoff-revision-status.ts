export interface DtoAppHandoffRevisionStatus {
  hostedStatus: string;
  latestSavedServed?: boolean;
  savedBuildStatus?: string;
  savedVersionNumber?: number;
  servedFromMain?: boolean;
  servedVersionNumber?: number;
}
