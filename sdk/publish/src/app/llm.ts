import type { Client } from "../client";
import type { DtoCreateLLMCallRequest, DtoLLM, DtoLLMCallUsageDTO } from "../models";
import { failureFrom, type OaizResponse } from "./response";

/** The answer of one model call. */
export interface OaizLLMCallResult {
  /** The model's answer. */
  text: string;
  /** The model that answered. */
  model: DtoLLM;
  /** The input and output tokens the provider counted. */
  usage: DtoLLMCallUsageDTO;
}

/** Calls models with this client's credential. */
export class OaizLLM {
  /** @internal */
  constructor(private readonly client: Client) {}

  /**
   * Asks `model` for one answer to `input`, under the optional `system` instruction. The call runs
   * as the credential's member, within the organisation's budget, on a model the organisation
   * permits in both chat and workflows. Waits up to five minutes for the answer. Never throws.
   */
  async call(request: DtoCreateLLMCallRequest): Promise<OaizResponse<OaizLLMCallResult>> {
    try {
      const answer = await this.client.createLlmCall(request, { timeoutMs: 300_000 });
      return {
        data: { text: answer.text, model: answer.model, usage: answer.usage },
        error: null,
        count: null,
        status: 200,
      };
    } catch (error) {
      return failureFrom(error);
    }
  }
}
