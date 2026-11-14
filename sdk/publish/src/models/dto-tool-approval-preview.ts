import type * as models from "./index";

export interface DtoToolApprovalPreview {
  peopleAndTeamsChange?: models.DtoPeopleAndTeamsChangePreview | null;
  resourceAccessChange?: models.DtoResourceAccessChangePreview | null;
}
