import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient, type DtoWorkflowRun, type OaizRun, type OaizRunStart } from "../../index";

const URL = "https://api.oaiz.test/";
const KEY = "oai_server_key";
const RUN = "7e570000-0000-4000-8000-000000000001";

let fetchMock: ReturnType<typeof vi.fn>;

const input = { event: { eventType: { provider: "custom", name: "x" } } };
const rootStart = { type: "root_start", sequence: 1, rootJobUuid: "job-1", actionExecutionLogUuid: RUN };
const finished: DtoWorkflowRun = {
  runUuid: RUN,
  rootJobUuid: "job-1",
  finished: true,
  status: "success",
  events: [],
  eventsPending: false,
  eventsTruncated: false,
  jobs: [],
};
const terminal = { type: "terminal", sequence: 3, rootJobUuid: "job-1", terminalReason: "success", run: finished };

function sse(...frames: string[]): Response {
  const bytes = new TextEncoder().encode(frames.join(""));
  // Split mid-frame so the parser must keep a partial frame between reads.
  const middle = Math.floor(bytes.length / 2);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, middle));
      controller.enqueue(bytes.slice(middle));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function frame(id: string, event: Record<string, unknown>): string {
  return `: ping\n\nid: ${id}\nevent: execute_progress\ndata: ${JSON.stringify(event)}\n\n`;
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runs", () => {
  it("starts a workflow run and yields unchanged frames and the final result", async () => {
    const actionLog = { type: "action_log", sequence: 2, rootJobUuid: "job-1" };
    fetchMock.mockResolvedValueOnce(sse(
      frame("c1", rootStart), frame("c2", actionLog), frame("c3", terminal), frame("c4", actionLog),
    ));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });
    const request: OaizRunStart = {
      workflow: "workflow-1", job: "job-1", branchId: "branch-1", runId: RUN,
      publishEvents: false, executeIntegrationCommand: false, executeIntegrationQuery: true, ...input,
    };
    const run: OaizRun = client.runs.start(request);

    expect((await collect(run)).map((item) => item.data)).toEqual([
      { event: rootStart, after: "c1" }, { event: actionLog, after: "c2" }, { event: terminal, after: "c3" },
    ]);
    await expect(run.result()).resolves.toEqual({ data: finished, error: null, count: null, status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.oaiz.test/ingest/workflows/workflow-1/runs/stream");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${KEY}`, Accept: "text/event-stream" });
    expect(JSON.parse(init.body as string)).toEqual({
      jobUuid: "job-1", branchId: "branch-1", runUuid: RUN,
      publishEvents: false, executeIntegrationCommand: false, executeIntegrationQuery: true, ...input,
    });
  });

  it("reads the result without iterating and only sends one request", async () => {
    fetchMock.mockResolvedValueOnce(sse(frame("c1", rootStart), frame("c3", terminal)));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });
    const run = client.runs.start({ workflow: "workflow-1", sourceEventUuid: "event-1" });

    const results = await Promise.all([run.result(), run.result()]);
    expect(results.map((result) => result.data)).toEqual([finished, finished]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.lastCall?.[1].body as string)).toEqual({ sourceEventUuid: "event-1" });
  });

  it("reads the result after pulling only some frames", async () => {
    fetchMock.mockResolvedValueOnce(sse(frame("c1", rootStart), frame("c3", terminal)));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });
    const run = client.runs.start({ workflow: "workflow-1", ...input });

    expect(await run[Symbol.asyncIterator]().next()).toMatchObject({ value: { data: { event: rootStart } } });
    await expect(run.result()).resolves.toMatchObject({ data: finished });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a cut terminal frame as a failure with the known run ID", async () => {
    fetchMock.mockResolvedValueOnce(sse(frame("c1", rootStart), frame("c3", terminal).slice(0, -2)));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });
    const run = client.runs.start({ workflow: "workflow-1", ...input });

    await expect(run.result()).resolves.toMatchObject({ data: null, status: 0, error: { message: expect.stringContaining(RUN) } });
  });

  it("reports a run that could not start with the reason from the terminal frame", async () => {
    fetchMock.mockResolvedValueOnce(sse(frame("c1", {
      type: "terminal", terminalReason: "root-start-failure", message: "Not permitted", slug: "not-permitted",
    })));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });
    const run = client.runs.start({ workflow: "workflow-1", ...input });

    await expect(run.result()).resolves.toMatchObject({ data: null, error: { message: "Not permitted", code: "not-permitted" } });
  });

  it("follows a run after a saved cursor and returns its waiting result", async () => {
    const waiting = { ...finished, status: "awaiting-approval", finished: false };
    fetchMock.mockResolvedValueOnce(sse(frame("c4", { type: "waiting", sequence: 4, rootJobUuid: "job-1", run: waiting })));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });

    const run = client.runs.follow(RUN, { after: "c3" });
    const frames = await collect(run);

    expect(frames).toHaveLength(1);
    expect(frames[0].data?.event.type).toBe("waiting");
    await expect(run.result()).resolves.toMatchObject({ data: waiting });
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.oaiz.test/ingest/action/log/${RUN}/events?after=c3`);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("GET");
  });

  it("follows from the start with the publishEvents the run was started with", async () => {
    fetchMock.mockResolvedValueOnce(sse(frame("c1", { type: "terminal", sequence: 1, rootJobUuid: "job-1" })));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });

    await collect(client.runs.follow(RUN, { publishEvents: false }));

    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.oaiz.test/ingest/action/log/${RUN}/events?publishEvents=false`);
  });

  it("stops reading and cancels the stream when the caller stops early", async () => {
    let cancelled = false;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(frame("c1", rootStart)));
      },
      cancel() {
        cancelled = true;
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });

    const run = client.runs.follow(RUN);
    for await (const progress of run) {
      expect(progress.data?.event.type).toBe("root_start");
      break;
    }

    expect(cancelled).toBe(true);
    expect(body.locked).toBe(false);
    await expect(run.result()).resolves.toMatchObject({ data: null, status: 0, error: { message: expect.stringContaining(RUN) } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts a pending result and releases the reader", async () => {
    const abort = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(frame("c1", rootStart)));
        abort.signal.addEventListener("abort", () => controller.error(abort.signal.reason), { once: true });
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });
    const run = client.runs.start({ workflow: "workflow-1", ...input, signal: abort.signal });

    await run[Symbol.asyncIterator]().next();
    const result = run.result();
    abort.abort(new Error("read stopped"));

    await expect(result).resolves.toMatchObject({
      data: null, status: 0, error: { message: expect.stringContaining(`read stopped (run ${RUN})`) },
    });
    expect(fetchMock.mock.lastCall?.[1].signal).toBe(abort.signal);
    expect(body.locked).toBe(false);
  });

  it("identifies an incomplete start or resume without a root_start frame", async () => {
    fetchMock.mockResolvedValueOnce(sse(frame("c1", rootStart).slice(0, -1)));
    fetchMock.mockResolvedValueOnce(sse(frame("c3", terminal).slice(0, -1)));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });

    await expect(client.runs.start({ workflow: "workflow-1", ...input, runId: RUN }).result())
      .resolves.toMatchObject({ data: null, status: 0, error: { message: expect.stringContaining(RUN) } });
    await expect(client.runs.follow(RUN, { after: "c2" }).result())
      .resolves.toMatchObject({ data: null, status: 0, error: { message: expect.stringContaining(RUN) } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not start a run when its signal is already aborted", async () => {
    const client = createClient({ url: URL, key: KEY, database: "db-1" });
    const signal = AbortSignal.abort(new Error("cancelled"));

    await expect(client.runs.start({ workflow: "workflow-1", ...input, signal }).result())
      .resolves.toMatchObject({ status: 0, error: { message: "cancelled" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the signed-in member's app access token on the stream", async () => {
    const storage = new Map<string, string>([[
      "oaiz.auth.view-1",
      JSON.stringify({ accessToken: "app-access", refreshToken: "refresh", expiresAt: Date.now() + 3_600_000, scope: "openid" }),
    ]]);
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    });
    vi.stubGlobal("location", { href: "https://notes.example.com/", assign: vi.fn() });
    vi.stubGlobal("history", { state: null, replaceState: vi.fn() });
    fetchMock.mockResolvedValueOnce(sse(frame("c1", { type: "terminal", sequence: 1, rootJobUuid: "job-1" })));
    const client = createClient({ url: URL, app: "view-1", database: "db-1" });

    await collect(client.runs.follow(RUN));

    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer app-access" });
  });

  it("yields one failure with the OAIZ slug when the stream is refused", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "not found", slug: "not-found" }), { status: 404 }));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });

    const run = client.runs.follow(RUN);
    const frames = await collect(run);

    expect(frames).toEqual([{ data: null, error: { message: "not found", code: "not-found", hints: [] }, count: null, status: 404 }]);
    await expect(run.result()).resolves.toMatchObject({ data: null, status: 404, error: { code: "not-found" } });
  });

  it("yields a status 0 failure when the connection breaks", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });

    const frames = await collect(client.runs.follow(RUN));

    expect(frames).toHaveLength(1);
    expect(frames[0].status).toBe(0);
    expect(frames[0].error?.message).toBe("network down");
  });

  it("reads one run and lists runs through the generated client", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(finished), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], hasMore: false, nextCursor: null }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });

    const run = await client.runs.get(RUN, { publishEvents: false });
    const page = await client.runs.list({ triggeringEventUuid: "evt-1" });

    expect(run.data).toEqual(finished);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://api.oaiz.test/ingest/runs/${RUN}?publishEvents=false`);
    expect(page.status).toBe(200);
    expect(page.data).toEqual({ items: [], hasMore: false, nextCursor: null });
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://api.oaiz.test/ingest/action/log?triggeringEventUuid=evt-1");
  });
});

function checkStartSignature(client: ReturnType<typeof createClient>) {
  // @ts-expect-error start takes a single object with a workflow ID
  client.runs.start("job-1", input);
}
