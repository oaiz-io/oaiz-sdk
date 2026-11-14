import type { Client } from "../client";
import type { DtoCommandMessageWithUUID, DtoEventInputInput } from "../models";
import { failureFrom, type OaizResponse } from "./response";

/** Publishes events with this client's credential. */
export class OaizEvents {
  /** @internal */
  constructor(private readonly client: Client) {}

  /** Publishes one event with this client's credential: with `app`, as the signed-in member. Never throws. */
  async publish(event: DtoEventInputInput): Promise<OaizResponse<DtoCommandMessageWithUUID>> {
    try {
      const data = await this.client.publishEvent({ contentType: "application/json", value: event });
      return { data, error: null, count: null, status: 201 };
    } catch (error) {
      return failureFrom(error);
    }
  }
}
