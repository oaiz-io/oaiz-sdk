import type * as models from "./index";

export interface DtoCreateEmbeddingsRequest {
  dimensions?: number | null;
  input: string[];
  model: models.DtoEmbeddingModel;
}
