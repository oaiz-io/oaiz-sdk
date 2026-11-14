import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient, type OaizChatDecision, type OaizChatMessage } from "../../index";

const URL = "https://api.oaiz.test/";
const APP = "7e570000-0000-4000-8000-0000000000a1";
const SESSION = "7e570000-0000-4000-8000-0000000000b1";
const MESSAGE_ID = "7e570000-0000-4000-8000-0000000000c1";
const CONNECTION = "7e570000-0000-4000-8000-0000000000d1";
const TOOL_CALL = "7e570000-0000-4000-8000-0000000000e1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

function frame(event: Record<string, unknown>): string {
  return `: ping\n\nevent: chat_event\ndata: ${JSON.stringify(event)}\n\n`;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

function appClient() {
  const storage = new Map<string, string>([[
    `oaiz.auth.${APP}`,
    JSON.stringify({ accessToken: "app-access", refreshToken: "refresh", expiresAt: Date.now() + 3_600_000, scope: "openid" }),
  ]]);
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });
  vi.stubGlobal("location", { href: "https://notes.example.com/", assign: vi.fn() });
  vi.stubGlobal("history", { state: null, replaceState: vi.fn() });
  return createClient({ url: URL, app: APP, database: "db-1" });
}

const message: OaizChatMessage = {
  content: "How many notes are there?",
  systemPrompt: "You answer questions about the member's notes.",
  nativeTools: [{ name: "storage_query" }],
  integrationTools: [{ integrationUuid: CONNECTION, actionType: "search_items" }],
};

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chat.send", () => {
  it("posts the message with the app token and yields each chat event until generation.finished", async () => {
    fetchMock.mockResolvedValueOnce(sse(
      frame({ type: "session.created", sessionId: SESSION, chatType: "app" }),
      frame({ type: "generation.started" }),
      frame({ type: "message.delta", delta: { messageId: "m-1", content: "There are " } }),
      frame({ type: "message.delta", delta: { messageId: "m-1", content: "3 notes." } }),
      frame({ type: "generation.finished" }),
      frame({ type: "message.delta", delta: { messageId: "m-1", content: "late" } }),
    ));
    const client = appClient();

    const events = await collect(client.chat.send({ ...message, clientMessageId: MESSAGE_ID, sessionId: SESSION }));

    expect(events.map((e) => e.data?.type)).toEqual([
      "session.created", "generation.started", "message.delta", "message.delta", "generation.finished",
    ]);
    expect(events[0]).toEqual({ data: { type: "session.created", sessionId: SESSION, chatType: "app" }, error: null, count: null, status: 200 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.oaiz.test/internalagents/chat/apps/${APP}/messages`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer app-access",
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body as string)).toEqual({ ...message, clientMessageId: MESSAGE_ID, sessionId: SESSION });
  });

  it("sends the author's system prompt unchanged and only the named tools", async () => {
    fetchMock.mockResolvedValueOnce(sse(frame({ type: "generation.finished" })));
    const client = appClient();

    await collect(client.chat.send({ content: "Hi", systemPrompt: "  Be brief.\n" }));

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.systemPrompt).toBe("  Be brief.\n");
    expect(Object.keys(body).sort()).toEqual(["clientMessageId", "content", "systemPrompt"]);
  });

  it("gives each message a new UUID clientMessageId when the caller sets none", async () => {
    fetchMock
      .mockResolvedValueOnce(sse(frame({ type: "generation.finished" })))
      .mockResolvedValueOnce(sse(frame({ type: "generation.finished" })));
    const client = appClient();

    await collect(client.chat.send(message));
    await collect(client.chat.send(message));

    const [first, second] = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).clientMessageId);
    expect(first).toMatch(UUID_PATTERN);
    expect(second).toMatch(UUID_PATTERN);
    expect(first).not.toBe(second);
  });

  it("yields a turn's error event and the generation.finished after it", async () => {
    fetchMock.mockResolvedValueOnce(sse(
      frame({ type: "generation.started" }),
      frame({ type: "error", error: { code: "budget-exceeded", message: "Budget exceeded" } }),
      frame({ type: "generation.finished" }),
    ));
    const client = appClient();

    const events = await collect(client.chat.send(message));

    expect(events.map((e) => e.status)).toEqual([200, 200, 200]);
    expect(events[1].data).toEqual({ type: "error", error: { code: "budget-exceeded", message: "Budget exceeded" } });
    expect(events[2].data?.type).toBe("generation.finished");
  });

  it("reads CRLF frames, multi-line data and multi-byte text delivered one byte per read", async () => {
    const bytes = new TextEncoder().encode([
      ": ping\r\n\r\n",
      "event: chat_event\r\nid: 1\r\ndata: {\"type\":\"message.delta\",\r\ndata: \"delta\":{\"content\":\"Hej då\"}}\r\n\r\n",
      "event:chat_event\rdata:{\"type\":\"generation.started\"}\r\r",
      "event: chat_event\r\ndata: {\"type\":\"generation.finished\"}\r\n\r\n",
    ].join(""));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const client = appClient();

    const events = await collect(client.chat.send(message));

    expect(events.map((e) => e.data)).toEqual([
      { type: "message.delta", delta: { content: "Hej då" } },
      { type: "generation.started" },
      { type: "generation.finished" },
    ]);
  });

  it("drops a frame the stream ends in the middle of", async () => {
    fetchMock.mockResolvedValueOnce(sse(
      frame({ type: "generation.started" }),
      `event: chat_event\ndata: {"type":"generation.finished"}\n`,
    ));
    const client = appClient();

    const events = await collect(client.chat.send(message));

    expect(events.map((e) => e.data?.type)).toEqual(["generation.started"]);
  });

  it("ignores frames of other event names", async () => {
    fetchMock.mockResolvedValueOnce(sse(
      `event: execute_progress\ndata: {"type":"terminal"}\n\n`,
      frame({ type: "generation.finished" }),
    ));
    const client = appClient();

    const events = await collect(client.chat.send(message));

    expect(events.map((e) => e.data?.type)).toEqual(["generation.finished"]);
  });

  it("yields one failure with the OAIZ slug and hints when the message is refused", async () => {
    fetchMock.mockResolvedValueOnce(json(400, {
      message: "native tool not allowed",
      slug: "invalid-native-tool",
      hints: ["Name a tool from chat.tools()"],
    }));
    const client = appClient();

    const events = await collect(client.chat.send({ ...message, nativeTools: [{ name: "resource_access_change" }] }));

    expect(events).toEqual([{
      data: null,
      error: { message: "native tool not allowed", code: "invalid-native-tool", hints: ["Name a tool from chat.tools()"] },
      count: null,
      status: 400,
    }]);
  });

  it("yields the status text when a refusal has no OAIZ body", async () => {
    fetchMock.mockResolvedValueOnce(new Response("upstream down", { status: 502, statusText: "Bad Gateway" }));
    const client = appClient();

    const events = await collect(client.chat.send(message));

    expect(events).toEqual([{ data: null, error: { message: "Bad Gateway", code: "", hints: [] }, count: null, status: 502 }]);
  });

  it("yields a status 0 failure when the connection breaks", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    const client = appClient();

    const events = await collect(client.chat.send(message));

    expect(events).toEqual([{ data: null, error: { message: "network down", code: "", hints: [] }, count: null, status: 0 }]);
  });

  it("passes the signal to the stream and ends with a status 0 failure when it aborts mid-turn", async () => {
    const encoder = new TextEncoder();
    fetchMock.mockImplementationOnce(async (_url: string, init: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(frame({ type: "generation.started" })));
          init.signal?.addEventListener("abort", () => controller.error(init.signal?.reason));
        },
      });
      return new Response(body, { status: 200 });
    });
    const client = appClient();
    const abort = new AbortController();

    const events = [];
    for await (const event of client.chat.send(message, { signal: abort.signal })) {
      events.push(event);
      if (event.data?.type === "generation.started") abort.abort();
    }

    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBe(abort.signal);
    expect(events.map((e) => e.status)).toEqual([200, 0]);
    expect(events[1].error?.message).toBe("This operation was aborted");
  });

  it("forwards requireApproval on each tool and yields tool.approvalRequired before generation.finished", async () => {
    const approvalInfo = { toolCallId: TOOL_CALL, toolName: "storage_query", args: { sql: "select count(*) from notes" }, approvalMode: "require_approval" };
    fetchMock.mockResolvedValueOnce(sse(
      frame({ type: "generation.started" }),
      frame({ type: "tool.approvalRequired", toolApprovalInfo: approvalInfo }),
      frame({ type: "generation.finished" }),
    ));
    const client = appClient();

    const events = await collect(client.chat.send({
      ...message,
      nativeTools: [{ name: "storage_query", requireApproval: true }],
      integrationTools: [{ integrationUuid: CONNECTION, actionType: "search_items", requireApproval: true }],
    }));

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.nativeTools).toEqual([{ name: "storage_query", requireApproval: true }]);
    expect(body.integrationTools).toEqual([{ integrationUuid: CONNECTION, actionType: "search_items", requireApproval: true }]);
    expect(events.map((e) => e.data?.type)).toEqual(["generation.started", "tool.approvalRequired", "generation.finished"]);
    expect(events[1].data?.toolApprovalInfo).toEqual(approvalInfo);
  });

  it("cancels the stream when the caller stops early", async () => {
    let cancelled = false;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(frame({ type: "generation.started" })));
      },
      cancel() {
        cancelled = true;
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const client = appClient();

    for await (const event of client.chat.send(message)) {
      expect(event.data?.type).toBe("generation.started");
      break;
    }

    expect(cancelled).toBe(true);
  });
});

describe("chat.approve and chat.decline", () => {
  const decision: OaizChatDecision = {
    sessionId: SESSION,
    toolCallId: TOOL_CALL,
    systemPrompt: message.systemPrompt,
    nativeTools: [{ name: "storage_query", requireApproval: true }],
  };

  it.each([
    ["approve", true],
    ["decline", false],
  ] as const)("%s posts the decision and the turn settings to the call's path and streams the continued turn", async (method, approved) => {
    fetchMock.mockResolvedValueOnce(sse(
      frame({ type: "generation.started" }),
      frame({ type: "message.delta", delta: { messageId: "m-2", content: "There are 3 notes." } }),
      frame({ type: "generation.finished" }),
      frame({ type: "message.delta", delta: { messageId: "m-2", content: "late" } }),
    ));
    const client = appClient();

    const events = await collect(client.chat[method](decision));

    expect(events.map((e) => e.data?.type)).toEqual(["generation.started", "message.delta", "generation.finished"]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.oaiz.test/internalagents/chat/apps/${APP}/sessions/${SESSION}/approvals/${TOOL_CALL}`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer app-access", Accept: "text/event-stream" });
    expect(JSON.parse(init.body as string)).toEqual({
      approved,
      systemPrompt: message.systemPrompt,
      nativeTools: [{ name: "storage_query", requireApproval: true }],
    });
  });

  it("encodes each path segment", async () => {
    fetchMock.mockResolvedValueOnce(sse(frame({ type: "generation.finished" })));
    const client = appClient();

    await collect(client.chat.approve({ ...decision, sessionId: "a/b", toolCallId: "c?d" }));

    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.oaiz.test/internalagents/chat/apps/${APP}/sessions/a%2Fb/approvals/c%3Fd`);
  });

  it("yields one failure with the OAIZ slug when the call is not waiting for a decision", async () => {
    fetchMock.mockResolvedValueOnce(json(409, { message: "the tool call is not waiting for a decision", slug: "app-chat-tool-call-not-pending" }));
    const client = appClient();

    const events = await collect(client.chat.approve(decision));

    expect(events).toEqual([{
      data: null,
      error: { message: "the tool call is not waiting for a decision", code: "app-chat-tool-call-not-pending", hints: [] },
      count: null,
      status: 409,
    }]);
  });
});

describe("chat.sessions", () => {
  it("lists one page of the app's chats with the app token", async () => {
    const page = { hasMore: true, nextCursor: "cursor-2", items: [{ id: SESSION, title: "Notes", chatType: "app" }] };
    fetchMock.mockResolvedValueOnce(json(200, page));
    const client = appClient();

    const result = await client.chat.sessions.list({ cursor: "cursor-1", pageSize: 20 });

    expect(result).toEqual({ data: page, error: null, count: null, status: 200 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.oaiz.test/internalagents/chat/apps/${APP}/sessions?cursor=cursor-1&pageSize=20`);
    expect(init.headers).toMatchObject({ Authorization: "Bearer app-access" });
  });

  it("reads one chat with its saved messages", async () => {
    const detail = { id: SESSION, chatType: "app", title: "Notes", createdAt: "2026-10-31T10:00:00Z", messageCount: 1, status: 0, messages: [] };
    fetchMock.mockResolvedValueOnce(json(200, detail));
    const client = appClient();

    const result = await client.chat.sessions.get(SESSION);

    expect(result).toEqual({ data: detail, error: null, count: null, status: 200 });
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.oaiz.test/internalagents/chat/apps/${APP}/sessions/${SESSION}`);
  });

  it("reads the pending tool call of a paused chat", async () => {
    const pendingApproval = { toolCallId: TOOL_CALL, toolName: "storage_query", args: { sql: "select 1" } };
    const detail = { id: SESSION, chatType: "app", title: "Notes", createdAt: "2026-10-31T10:00:00Z", messageCount: 2, status: 0, messages: [], pendingApproval };
    fetchMock.mockResolvedValueOnce(json(200, detail));
    const client = appClient();

    const result = await client.chat.sessions.get(SESSION);

    expect(result.data?.pendingApproval).toEqual(pendingApproval);
  });

  it("answers a chat outside the app with the OAIZ slug instead of throwing", async () => {
    fetchMock.mockResolvedValueOnce(json(404, { message: "chat session not found", slug: "chat-session-not-found" }));
    const client = appClient();

    const result = await client.chat.sessions.get(SESSION);

    expect(result).toEqual({ data: null, error: { message: "chat session not found", code: "chat-session-not-found", hints: [] }, count: null, status: 404 });
  });
});

describe("chat.tools", () => {
  it("lists the app chat natives and only the integration actions", async () => {
    const native = { name: "storage_query", actionType: "storage_query", provider: "oaiz", category: "storage", description: "Query", inputSchema: {}, annotations: {} };
    const integration = { kind: "integration", name: "Search items", selector: `${CONNECTION}:search_items`, integrationUuid: CONNECTION, actionType: "search_items", description: "Search", configSnippet: {} };
    fetchMock.mockImplementation(async (url: string) => String(url).includes("/ingest/tools/native")
      ? json(200, { items: [native] })
      : json(200, {
        job: "agent",
        integrationDiagnostics: [],
        items: [{ kind: "native", name: "storage_query", selector: "storage_query", description: "Query", configSnippet: {} }, integration],
      }));
    const client = appClient();

    const result = await client.chat.tools();

    expect(result).toEqual({ data: { nativeTools: [native], integrationTools: [integration] }, error: null, count: null, status: 200 });
    const urls = fetchMock.mock.calls.map(([url]) => String(url)).sort();
    expect(urls).toEqual(["https://api.oaiz.test/ingest/tools", "https://api.oaiz.test/ingest/tools/native?surface=app"]);
  });

  it("answers a refused list with the OAIZ slug instead of throwing", async () => {
    fetchMock.mockImplementation(async (url: string) => String(url).includes("/ingest/tools/native")
      ? json(200, { items: [] })
      : json(403, { message: "forbidden", slug: "app-token-route-forbidden" }));
    const client = appClient();

    const result = await client.chat.tools();

    expect(result).toEqual({ data: null, error: { message: "forbidden", code: "app-token-route-forbidden", hints: [] }, count: null, status: 403 });
  });
});
