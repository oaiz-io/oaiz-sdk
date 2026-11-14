import type { Client } from "../client";
import type { DtoToolRunRequest, DtoToolRunResult } from "../models";
import { failureFrom, type OaizResponse } from "./response";

/** Runs tools with this client's credential. */
export class OaizTools {
  /** @internal */
  constructor(private readonly client: Client) {}

  /** Runs a built-in OAIZ tool by name, or an integration action as `<integration id>:<action>`. Never throws. */
  async run(selector: string, request: DtoToolRunRequest): Promise<OaizResponse<DtoToolRunResult>> {
    try {
      const data = await this.client.runTool(selector, request, { timeoutMs: 1_200_000 });
      return { data, error: null, count: null, status: 200 };
    } catch (error) {
      return failureFrom(error);
    }
  }
}
