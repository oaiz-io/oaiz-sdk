import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "../../index";

const URL = "https://api.oaiz.test";
const KEY = "oai_server_key";
const DATABASE = "db-1";

type Answer = { status: number; body: unknown };

let answers: Answer[];
let fetchMock: ReturnType<typeof vi.fn>;

function json(status: number, body: unknown): Answer {
  return { status, body };
}

beforeEach(() => {
  answers = [];
  fetchMock = vi.fn(async () => {
    const answer = answers.shift() ?? json(201, { message: "Event published", uuid: "evt-1" });
    return new Response(JSON.stringify(answer.body), {
      status: answer.status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function sent(index = 0): { url: string; method: string; body: unknown; headers: Record<string, string> } {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return {
    url,
    method: init.method ?? "GET",
    body: JSON.parse(init.body as string),
    headers: init.headers as Record<string, string>,
  };
}

describe("events.publish", () => {
  it("sends POST /ingest/event/publish with the JSON body and the bearer token, and answers data on 201", async () => {
    const event = {
      eventType: { provider: "custom-provider", name: "label" },
      properties: { test: "test" },
    };
    answers.push(json(201, { message: "Event published", uuid: "evt-1" }));

    const result = await createClient({ url: URL, key: KEY, database: DATABASE }).events.publish(event);

    const request = sent();
    expect(request.method).toBe("POST");
    expect(request.url).toBe(`${URL}/ingest/event/publish`);
    expect(request.body).toEqual(event);
    expect(request.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(result).toEqual({
      data: { message: "Event published", uuid: "evt-1" },
      error: null,
      count: null,
      status: 201,
    });
  });

  it("answers error.code from the slug on 400", async () => {
    answers.push(json(400, { message: "reserved provider", slug: "reserved-provider-name" }));

    const result = await createClient({ url: URL, key: KEY, database: DATABASE }).events.publish({
      eventType: { provider: "storage", name: "label" },
    });

    expect(result).toEqual({
      data: null,
      error: { message: "reserved provider", code: "reserved-provider-name", hints: [] },
      count: null,
      status: 400,
    });
  });
});
