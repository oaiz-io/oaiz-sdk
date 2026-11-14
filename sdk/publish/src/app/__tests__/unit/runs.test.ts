import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "../../index";

const URL = "https://api.oaiz.test/";
const KEY = "oai_server_key";
const RUN = "7e570000-0000-4000-8000-000000000001";

let fetchMock: ReturnType<typeof vi.fn>;

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
  it("starts a job on the execute stream and yields each frame with its cursor until the run ends", async () => {
    fetchMock.mockResolvedValueOnce(sse(
      frame("c1", { type: "root_start", sequence: 1, rootJobUuid: "job-1", actionExecutionLogUuid: RUN }),
      frame("c2", { type: "action_log", sequence: 2, rootJobUuid: "job-1" }),
      frame("c3", { type: "terminal", sequence: 3, rootJobUuid: "job-1", terminalReason: "success" }),
      frame("c4", { type: "action_log", sequence: 4, rootJobUuid: "job-1" }),
    ));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });

    const frames = await collect(client.runs.start("job-1", { actionExecutionUuid: RUN, event: { eventType: { provider: "custom", name: "x" } } }));

    expect(frames.map((f) => [f.data?.event.type, f.data?.after])).toEqual([
      ["root_start", "c1"], ["action_log", "c2"], ["terminal", "c3"],
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.oaiz.test/ingest/jobs/job-1/execute/stream");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${KEY}`, Accept: "text/event-stream" });
    expect(JSON.parse(init.body as string)).toMatchObject({ actionExecutionUuid: RUN });
  });

  it("follows a run after a saved cursor", async () => {
    fetchMock.mockResolvedValueOnce(sse(frame("c4", { type: "waiting", sequence: 4, rootJobUuid: "job-1" })));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });

    const frames = await collect(client.runs.follow(RUN, { after: "c3" }));

    expect(frames).toHaveLength(1);
    expect(frames[0].data?.event.type).toBe("waiting");
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
        controller.enqueue(encoder.encode(frame("c1", { type: "root_start", sequence: 1, rootJobUuid: "job-1" })));
      },
      cancel() {
        cancelled = true;
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });

    for await (const progress of client.runs.follow(RUN)) {
      expect(progress.data?.event.type).toBe("root_start");
      break;
    }

    expect(cancelled).toBe(true);
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

    const frames = await collect(client.runs.follow(RUN));

    expect(frames).toEqual([{ data: null, error: { message: "not found", code: "not-found", hints: [] }, count: null, status: 404 }]);
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ uuid: RUN, status: "success" }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], hasMore: false, nextCursor: null }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = createClient({ url: URL, key: KEY, database: "db-1" });

    const run = await client.runs.get(RUN);
    const page = await client.runs.list({ triggeringEventUuid: "evt-1" });

    expect(run.data?.uuid).toBe(RUN);
    expect(page.status).toBe(200);
    expect(page.data).toEqual({ items: [], hasMore: false, nextCursor: null });
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://api.oaiz.test/ingest/action/log?triggeringEventUuid=evt-1");
  });
});
