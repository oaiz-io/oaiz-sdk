import type { Client } from "../client";
import type { DtoCreateEmbeddingsRequest, DtoEmbeddingModel } from "../models";
import { failureFrom, type OaizResponse } from "./response";

/** The vectors of one embeddings call. */
export interface OaizEmbeddingsResult {
  /** The model that produced the vectors; store it beside each vector. */
  model: DtoEmbeddingModel;
  /** The length of every vector. */
  dimensions: number;
  /** One vector per input, in input order. `JSON.stringify(vector)` is a pgvector literal. */
  embeddings: number[][];
  /** The input tokens the provider counted. */
  inputTokens: number;
}

/** Turns texts into vectors with this client's credential. */
export class OaizEmbeddings {
  /** @internal */
  constructor(private readonly client: Client) {}

  /**
   * Turns each input text into one vector on `model`. Vectors from different models, or from one
   * model at different dimensions, are not comparable. The call runs on the account the organisation's
   * admin chooses for embeddings in AI feature settings: OAIZ or an organisation OpenAI key. Never throws.
   */
  async create(request: DtoCreateEmbeddingsRequest): Promise<OaizResponse<OaizEmbeddingsResult>> {
    try {
      const answer = await this.client.createEmbeddings(request, { timeoutMs: 120_000 });
      const embeddings: number[][] = [];
      for (const item of answer.data) embeddings[item.index] = item.embedding;
      return {
        data: { model: answer.model, dimensions: answer.dimensions, embeddings, inputTokens: answer.usage.inputTokens },
        error: null,
        count: null,
        status: 200,
      };
    } catch (error) {
      return failureFrom(error);
    }
  }
}
