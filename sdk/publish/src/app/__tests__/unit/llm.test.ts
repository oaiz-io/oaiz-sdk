import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DtoCreateLLMCallRequest, DtoCreateLLMCallResponse } from "../../../models";
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

const reply: DtoCreateLLMCallResponse = {
  text: "The customer asks for a refund of order 1042.",
  model: "openai/gpt-6-luna",
  usage: { inputTokens: 30, outputTokens: 12 },
};

describe("llm.call", () => {
  it("posts the request with the key credential and answers the text, model and usage", async () => {
    answer(200, reply);
    const request: DtoCreateLLMCallRequest = {
      model: "openai/gpt-6-luna",
      system: "Answer in one sentence.",
      input: "Summarise this email thread.",
    };

    const result = await createClient({ url: URL, key: KEY, database: DATABASE }).llm.call(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${URL}/ingest/llm/call`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual(request);
    expect(result).toEqual({ data: reply, error: null, count: null, status: 200 });
  });

  it("waits for an answer past the ordinary request deadline up to the route's five-minute budget", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal;
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(new Response(JSON.stringify(reply), {
          headers: { "content-type": "application/json" },
        })), 299_999);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }, { once: true });
      });
    });

    const result = createClient({ url: URL, key: KEY, database: DATABASE }).llm.call({
      model: "openai/gpt-6-luna",
      input: "text",
    });

    await vi.advanceTimersByTimeAsync(60_001);
    expect(signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(239_998);
    expect((await result).data?.text).toBe(reply.text);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts a call that outlasts the route's five-minute budget", async () => {
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

    const result = createClient({ url: URL, key: KEY, database: DATABASE }).llm.call({
      model: "openai/gpt-6-luna",
      input: "text",
    });

    await vi.advanceTimersByTimeAsync(299_999);
    expect(signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal!.aborted).toBe(true);
    expect((await result).data).toBeNull();
  });

  it.each([
    [402, "Your organisation has reached its budget limit.", "budget-exceeded"],
    [403, "The model is not permitted in workflows for your organisation.", "llm-model-not-permitted"],
  ])("answers a %s refusal with its status, message and slug", async (status, message, slug) => {
    answer(status, { message, slug });

    const result = await createClient({ url: URL, key: KEY, database: DATABASE }).llm.call({
      model: "openai/gpt-6-luna",
      input: "text",
    });

    expect(result).toEqual({ data: null, error: { message, code: slug, hints: [] }, count: null, status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
