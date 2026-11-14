import type { RawRequest } from "./raw-request";
import { failure, failureFrom, type OaizResponse } from "./response";

/** Opens one SSE request with this client's credential. */
export type OpenStream = (request: RawRequest, body?: unknown, signal?: AbortSignal) => Promise<Response>;

/** One frame's JSON payload and its `id`. */
export interface SseFrame<T> {
  data: T;
  id?: string;
}

/** Splits an SSE byte stream into the frames of one event name. A frame cut off at the end is dropped. */
export class SseFrames<T> {
  private readonly decoder = new TextDecoder();
  private buffer = "";

  constructor(private readonly eventName: string) {}

  *push(bytes?: Uint8Array): Generator<SseFrame<T>> {
    this.buffer += this.decoder.decode(bytes, { stream: bytes !== undefined });
    // A read that ends in `\r` may be the first half of `\r\n`; keep it raw for the next read.
    const held = bytes !== undefined && this.buffer.endsWith("\r") ? "\r" : "";
    const text = held ? this.buffer.slice(0, -1) : this.buffer;
    const blocks = text.replace(/\r\n?/g, "\n").split("\n\n");
    this.buffer = (blocks.pop() ?? "") + held;
    for (const block of blocks) {
      let name = "";
      let id: string | undefined;
      const data: string[] = [];
      for (const line of block.split("\n")) {
        const colon = line.indexOf(":");
        if (colon === 0) continue;
        const field = colon < 0 ? line : line.slice(0, colon);
        const raw = colon < 0 ? "" : line.slice(colon + 1);
        const value = raw.startsWith(" ") ? raw.slice(1) : raw;
        if (field === "event") name = value;
        if (field === "id") id = value;
        if (field === "data") data.push(value);
      }
      if (name === this.eventName && data.length > 0) {
        yield { data: JSON.parse(data.join("\n")) as T, id };
      }
    }
  }
}

/**
 * Opens one SSE request and yields its `eventName` frames until `isLast` holds for one or the
 * stream ends. A refusal yields one failure with its `error.code` and anything else that stops the
 * stream one status 0 failure. Stopping early cancels the stream.
 */
export async function* readSseStream<T>(
  open: OpenStream,
  request: RawRequest,
  body: unknown,
  signal: AbortSignal | undefined,
  eventName: string,
  isLast: (data: T) => boolean,
): AsyncGenerator<OaizResponse<SseFrame<T>>> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await open(request, body, signal);
    if (!response.ok || response.body === null) {
      const refusal = await response.json().catch(() => ({}));
      yield failure(response.status, {
        message: typeof refusal.message === "string" ? refusal.message : response.statusText,
        code: typeof refusal.slug === "string" ? refusal.slug : "",
        hints: Array.isArray(refusal.hints) ? refusal.hints : [],
      });
      return;
    }
    reader = response.body.getReader();
    const frames = new SseFrames<T>(eventName);
    while (true) {
      const { done, value } = await reader.read();
      for (const frame of frames.push(done ? undefined : value)) {
        yield { data: frame, error: null, count: null, status: 200 };
        if (isLast(frame.data)) return;
      }
      if (done) return;
    }
  } catch (error) {
    yield failureFrom(error);
  } finally {
    await reader?.cancel().catch(() => {});
  }
}
