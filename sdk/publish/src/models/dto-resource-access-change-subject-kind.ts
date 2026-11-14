export const DtoResourceAccessChangeSubjectKind = {
  App: "app",
  OrganisationAdministrators: "organisation_administrators",
  OrganisationAudience: "organisation_audience",
  Team: "team",
  User: "user",
} as const;
export type DtoResourceAccessChangeSubjectKind = (typeof DtoResourceAccessChangeSubjectKind)[keyof typeof DtoResourceAccessChangeSubjectKind];
