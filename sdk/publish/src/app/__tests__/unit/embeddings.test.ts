import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DtoCreateEmbeddingsRequest, DtoCreateEmbeddingsResponse } from "../../../models";
import { createClient } from "../../index";

const URL = "https://api.oaiz.test";
const KEY = "oai_server_key";
const DATABASE = "db-1";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function answer(status: number, body: unknown): void {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
}

describe("embeddings.create", () => {
  it("posts the request with the key credential and answers the vectors in input order", async () => {
    const response: DtoCreateEmbeddingsResponse = {
      model: "text-embedding-3-small",
      dimensions: 2,
      data: [
        { index: 1, embedding: [0.3, 0.4] },
        { index: 0, embedding: [0.1, 0.2] },
      ],
      usage: { inputTokens: 7 },
    };
    answer(200, response);
    const request: DtoCreateEmbeddingsRequest = { model: "text-embedding-3-small", input: ["first", "second"], dimensions: 2 };

    const result = await createClient({ url: URL, key: KEY, database: DATABASE }).embeddings.create(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${URL}/ingest/embeddings`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual(request);
    expect(result).toEqual({
      data: {
        model: "text-embedding-3-small",
        dimensions: 2,
        embeddings: [[0.1, 0.2], [0.3, 0.4]],
        inputTokens: 7,
      },
      error: null,
      count: null,
      status: 200,
    });
  });

  it("waits for vectors past the ordinary request deadline up to the route's two-minute budget", async () => {
    vi.useFakeTimers();
    const response: DtoCreateEmbeddingsResponse = {
      model: "text-embedding-3-small",
      dimensions: 1,
      data: [{ index: 0, embedding: [1] }],
      usage: { inputTokens: 1 },
    };
    let signal: AbortSignal;
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(new Response(JSON.stringify(response), {
          headers: { "content-type": "application/json" },
        })), 90_000);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }, { once: true });
      });
    });

    const result = createClient({ url: URL, key: KEY, database: DATABASE }).embeddings.create({
      model: "text-embedding-3-small",
      input: ["text"],
    });

    await vi.advanceTimersByTimeAsync(60_001);
    expect(signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(29_999);
    expect((await result).data?.embeddings).toEqual([[1]]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts a call that outlasts the route's two-minute budget", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal;
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }, { once: true });
      });
    });

    const result = createClient({ url: URL, key: KEY, database: DATABASE }).embeddings.create({
      model: "text-embedding-3-small",
      input: ["text"],
    });

    await vi.advanceTimersByTimeAsync(119_999);
    expect(signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal!.aborted).toBe(true);
    expect((await result).data).toBeNull();
  });

  it("answers a refusal with its status, message and slug", async () => {
    const message = "unknown embedding model; supported models: text-embedding-3-large, text-embedding-3-small";
    answer(400, { message, slug: "embedding-model-unknown" });

    const result = await createClient({ url: URL, key: KEY, database: DATABASE }).embeddings.create({
      model: "text-embedding-ada-002" as "text-embedding-3-small",
      input: ["text"],
    });

    expect(result).toEqual({ data: null, error: { message, code: "embedding-model-unknown", hints: [] }, count: null, status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
