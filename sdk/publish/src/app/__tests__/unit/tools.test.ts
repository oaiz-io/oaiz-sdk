import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DtoToolRunRequest, DtoToolRunResult } from "../../../models";
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

const request: DtoToolRunRequest = {
  arguments: { databaseUuid: DATABASE, sql: "SELECT * FROM notes WHERE title = $1", params: ["Hello"] },
  executeIntegrationCommand: false,
  executeIntegrationQuery: true,
};

describe("tools.run", () => {
  it.each([
    { selector: "storage_query", kind: "native" },
    { selector: "7e570000-0000-4000-8000-000000000001:search_items", kind: "integration" },
  ] as const)("sends the encoded $kind selector, unchanged body and key credential", async ({ selector, kind }) => {
    const data: DtoToolRunResult = {
      selector,
      kind,
      result: { rows: [{ title: "Hello" }] },
      fileArtifacts: [{ fileId: "file-1", filename: "notes.csv", contentType: "text/csv", size: 6 }],
      usage: {
        latencyMs: 12,
        provider: "storage",
        requestSize: 64,
        responseSize: 32,
        success: true,
        toolName: selector,
        toolType: kind,
        units: 1,
        unitType: "query",
      },
    };
    answer(200, data);
    const body = { ...request, executeIntegrationCommand: kind === "integration" };

    const result = await createClient({ url: URL, key: KEY, database: DATABASE }).tools.run(selector, body);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${URL}/ingest/tools/${encodeURIComponent(selector)}/run`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual(body);
    expect(result).toEqual({ data, error: null, count: null, status: 200 });
  });

  it("keeps a nullable tool result in the success envelope and sends explicit false flags", async () => {
    const data: DtoToolRunResult = { selector: "storage_query", kind: "native", result: null };
    answer(200, data);
    const mockRequest = { arguments: {}, executeIntegrationCommand: false, executeIntegrationQuery: false };

    const result = await createClient({ url: URL, key: KEY, database: DATABASE }).tools.run("storage_query", mockRequest);

    expect(result).toEqual({ data, error: null, count: null, status: 200 });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual(mockRequest);
  });

  it.each([
    { status: 400, slug: "invalid-workflow-tool-input" },
    { status: 401, slug: "session-revoked" },
    { status: 403, slug: "storage-database-access-denied" },
    { status: 404, slug: "workflow-tool-not-found" },
    { status: 500, slug: "integration-provider-error" },
  ])("preserves the HTTP $status error message, slug and hints", async ({ status, slug }) => {
    const message = "The tool request was refused";
    const hints = ["Check the selected resource"];
    answer(status, { message, slug, hints });

    const result = await createClient({ url: URL, key: KEY, database: DATABASE }).tools.run("storage_query", request);

    expect(result).toEqual({ data: null, error: { message, code: slug, hints }, count: null, status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns status zero when no response arrives", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));

    const result = await createClient({ url: URL, key: KEY, database: DATABASE }).tools.run("storage_query", request);

    expect(result).toEqual({ data: null, error: { message: "network down", code: "", hints: [] }, count: null, status: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a tool result that arrives after the ordinary request deadline", async () => {
    vi.useFakeTimers();
    const data: DtoToolRunResult = { selector: "storage_query", kind: "native", result: { rows: [] } };
    let signal: AbortSignal;
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(new Response(JSON.stringify(data), {
          headers: { "content-type": "application/json" },
        })), 75_000);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }, { once: true });
      });
    });

    const result = createClient({ url: URL, key: KEY, database: DATABASE }).tools.run("storage_query", request);

    await vi.advanceTimersByTimeAsync(60_001);
    expect(signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(await result).toEqual({ data, error: null, count: null, status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds tool calls to twenty minutes while keeping the ordinary database deadline", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const signal = init.signal as AbortSignal;
      signals.push(signal);
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }, { once: true });
      });
    });
    const client = createClient({ url: URL, key: KEY, database: DATABASE });
    const toolResult = client.tools.run("storage_query", request);
    const databaseResult = Promise.resolve(client.from("notes").select());

    await vi.advanceTimersByTimeAsync(59_999);
    expect(signals.map((signal) => signal.aborted)).toEqual([false, false]);
    await vi.advanceTimersByTimeAsync(1);
    expect(signals.map((signal) => signal.aborted)).toEqual([false, true]);
    expect((await databaseResult).status).toBe(0);
    await vi.advanceTimersByTimeAsync(1_139_999);
    expect(signals[0].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signals[0].aborted).toBe(true);
    expect((await toolResult).status).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
