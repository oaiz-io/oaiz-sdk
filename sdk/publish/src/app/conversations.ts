import type { Client, ListOaizChatMessagesParams } from "../client";
import type {
  DtoOaizChatMessage,
  DtoOaizChatMessagePage,
  DtoOaizChatSendMessageReceipt,
  DtoOaizChatSendMessageRequest,
  DtoOaizChatThreadStateFrame,
} from "../models";
import { failure, failureFrom, type OaizResponse } from "./response";
import { readSseStream, type OpenStream } from "./sse-stream";

export type OaizConversationHistoryOptions = ListOaizChatMessagesParams & { signal?: AbortSignal };

export interface OaizConversationFollowOptions {
  /** Resume after the cursor on a message frame or the first history page's `latestCursor`. */
  after?: string;
  /** Closes the stream. The Conversation agent keeps running. */
  signal?: AbortSignal;
}

/** One committed message or a change in the thread's state. Only a message advances the cursor. */
export type OaizConversationFrame =
  | { type: "message"; message: DtoOaizChatMessage; after: string }
  | { type: "state"; state: DtoOaizChatThreadStateFrame["state"] };

/** OAIZ Chat operations for a customer-owned chat server. */
export class OaizConversations {
  /** @internal */
  constructor(private readonly client: Client, private readonly open: OpenStream) {}

  /** Accepts a message for delivery. Reuse its `clientMessageId` when resending. */
  async send(
    connectionId: string,
    threadId: string,
    message: DtoOaizChatSendMessageRequest,
    options?: { signal?: AbortSignal },
  ): Promise<OaizResponse<DtoOaizChatSendMessageReceipt>> {
    try {
      const data = await this.client.sendOaizChatMessage(connectionId, threadId, message, options);
      return { data, error: null, count: null, status: 202 };
    } catch (error) {
      return failureFrom(error);
    }
  }

  /** Gets committed messages newest first. Pass `nextCursor` as `cursor` to read an older page. */
  async history(
    connectionId: string,
    threadId: string,
    { signal, ...params }: OaizConversationHistoryOptions = {},
  ): Promise<OaizResponse<DtoOaizChatMessagePage>> {
    try {
      const data = await this.client.listOaizChatMessages(connectionId, threadId, params, { signal });
      return { data, error: null, count: null, status: 200 };
    } catch (error) {
      return failureFrom(error);
    }
  }

  /** Reads committed messages oldest first and follows thread state until the stream closes. */
  async *follow(
    connectionId: string,
    threadId: string,
    { after, signal }: OaizConversationFollowOptions = {},
  ): AsyncGenerator<OaizResponse<OaizConversationFrame>> {
    const query = new URLSearchParams();
    if (after !== undefined) query.set("after", after);
    const frames = readSseStream<DtoOaizChatMessage | DtoOaizChatThreadStateFrame>(
      this.open,
      { operation: "followOaizChatThread", params: { connectionId, threadId }, query },
      undefined,
      signal,
      ["message", "state"],
    );
    for await (const frame of frames) {
      if (frame.error !== null) {
        yield frame;
        return;
      }
      const { data, name, id } = frame.data;
      const object = typeof data === "object" && data !== null;
      if (name === "state" && object && "state" in data) {
        yield { ...frame, data: { type: "state", state: data.state } };
      } else if (name === "message" && id && object && "role" in data) {
        yield { ...frame, data: { type: "message", message: data, after: id } };
      } else {
        yield failure(0, { code: "", message: "Invalid OAIZ Chat stream frame.", hints: [] });
        return;
      }
    }
  }
}
