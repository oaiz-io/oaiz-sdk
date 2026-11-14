import type * as models from "./index";

export interface DtoCreateEmbeddingsResponse {
  data: models.DtoEmbeddingDTO[];
  dimensions: number;
  model: models.DtoEmbeddingModel;
  usage: models.DtoEmbeddingsUsageDTO;
}
