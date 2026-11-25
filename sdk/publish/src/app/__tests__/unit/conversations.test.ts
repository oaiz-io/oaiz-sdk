import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient, type DtoOaizChatMessage } from "../../index";

const url = "https://api.oaiz.test";
const key = "oaiz_service_test_key";
const threadURL = `${url}/ingest/oaiz-chat/connection/threads/shop-thread`;
const message: DtoOaizChatMessage = {
  id: "message-uuid",
  sender: "",
  role: "agent",
  text: "We open at nine.",
  sentAt: "2026-11-24T08:00:00Z",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("conversations", () => {
  it("sends and reads a page using the same key and no database", async () => {
    const receipt = { threadId: "shop-thread", messageId: "visitor-message" };
    const page = { items: [message], hasMore: false, latestCursor: null, nextCursor: null };
    fetchMock.mockImplementationOnce(async () => Response.json(receipt, { status: 202 }));
    fetchMock.mockImplementationOnce(async () => Response.json(page));
    const { conversations } = createClient({ url, key });
    const input = { clientMessageId: "visitor-message", sender: "Visitor", text: "When do you open?" };
    const abortController = new AbortController();

    await expect(conversations.send("connection", "shop-thread", input)).resolves.toMatchObject({ data: receipt, status: 202 });
    await expect(conversations.history("connection", "shop-thread", { cursor: "older/", pageSize: 3, signal: abortController.signal }))
      .resolves.toMatchObject({ data: page, status: 200 });

    const [[sendURL, send], [historyURL, history]] = fetchMock.mock.calls as [string, RequestInit][];
    expect(sendURL).toBe(`${threadURL}/messages`);
    expect(send.method).toBe("POST");
    expect(new Headers(send.headers).get("Authorization")).toBe(`Bearer ${key}`);
    expect(JSON.parse(send.body as string)).toEqual(input);
    expect(new URL(historyURL).pathname).toBe(new URL(`${threadURL}/messages`).pathname);
    expect(Object.fromEntries(new URL(historyURL).searchParams)).toEqual({ cursor: "older/", pageSize: "3" });
    expect(history.signal).toBeInstanceOf(AbortSignal);
  });

  it("streams named frames, retains a message cursor, and cancels on return", async () => {
    let bodyController!: ReadableStreamDefaultController<Uint8Array>;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) { bodyController = controller; },
      cancel,
    });
    fetchMock.mockResolvedValueOnce(new Response(body, { headers: { "content-type": "text/event-stream" } }));
    const controller = new AbortController();
    const stream = createClient({ url, key }).conversations.follow("connection", "shop-thread", {
      after: "previous/", signal: controller.signal,
    });
    const encoder = new TextEncoder();
    bodyController.enqueue(encoder.encode(': ping\r\n\r\nevent: state\r\ndata: {"state":"work'));
    bodyController.enqueue(encoder.encode(`ing"}\r\n\r\nevent: message\nid: newest\ndata: ${JSON.stringify(message)}\n\n`));
    await expect(stream.next()).resolves.toMatchObject({ value: { data: { type: "state", state: "working" } } });
    await expect(stream.next()).resolves.toMatchObject({ value: { data: { type: "message", after: "newest", message } } });
    await stream.return(undefined);
    expect(cancel).toHaveBeenCalledOnce();
    const [requestURL, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestURL).toBe(`${threadURL}/events?after=previous%2F`);
    expect(request.headers).toMatchObject({ Authorization: `Bearer ${key}`, Accept: "text/event-stream" });
    expect(request.signal).toBe(controller.signal);
  });

  it("returns API errors and handles an already canceled follow", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ message: "Connection not found", slug: "integration-not-found" }, { status: 404 }));
    const { conversations } = createClient({ url, key });
    await expect(conversations.follow("connection", "shop-thread").next()).resolves.toMatchObject({
      value: { status: 404, error: { message: "Connection not found", code: "integration-not-found" } },
    });
    const controller = new AbortController();
    controller.abort();
    await expect(conversations.follow("connection", "shop-thread", { signal: controller.signal }).next()).resolves.toMatchObject({
      value: { status: 0 },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
