export const DtoEmbeddingModel = {
  TextEmbedding3Large: "text-embedding-3-large",
  TextEmbedding3Small: "text-embedding-3-small",
} as const;
export type DtoEmbeddingModel = (typeof DtoEmbeddingModel)[keyof typeof DtoEmbeddingModel];
