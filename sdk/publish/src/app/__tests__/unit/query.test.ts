import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "../../index";

const URL = "https://api.oaiz.test";
const KEY = "oai_server_key";
const DATABASE = "db-1";

type Answer = { status: number; body: unknown; contentType?: string };

let answers: Answer[];
let fetchMock: ReturnType<typeof vi.fn>;

function json(status: number, body: unknown): Answer {
  return { status, body };
}

beforeEach(() => {
  answers = [];
  fetchMock = vi.fn(async () => {
    const answer = answers.shift() ?? json(200, { rows: [] });
    const text =
      typeof answer.body === "string" ? answer.body : JSON.stringify(answer.body);
    return new Response(text, {
      status: answer.status,
      headers: { "content-type": answer.contentType ?? "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function db() {
  return createClient({ url: URL, key: KEY, database: DATABASE });
}

function sent(index = 0): { url: string; body: unknown; headers: Record<string, string> } {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return {
    url,
    body: JSON.parse(init.body as string),
    headers: init.headers as Record<string, string>,
  };
}

describe("request compilation", () => {
  it("sends a select with whitespace removed outside quotes and the exact count", async () => {
    await db()
      .from("deals")
      .select(' id, name,\n company:companies ( "display name" ) ', { count: "exact" });
    const request = sent();
    expect(request.url).toBe(`${URL}/storage/databases/${DATABASE}/rows/select`);
    expect(request.body).toEqual({
      table: "deals",
      select: 'id,name,company:companies("display name")',
      count: "exact",
    });
  });

  it("selects every column by default", async () => {
    await db().from("deals").select();
    expect(sent().body).toEqual({ table: "deals", select: "*" });
  });

  it("compiles comparisons to string values", async () => {
    await db()
      .from("deals")
      .select("id")
      .eq("stage", "open")
      .neq("name", "x")
      .gt("amount", 10)
      .gte("amount", 1.5)
      .lt("created_at", "2026-01-01")
      .lte("closed", false)
      .eq("company.name", "Acme");
    expect(sent().body).toEqual({
      table: "deals",
      select: "id",
      filters: [
        { column: "stage", operator: "eq", value: "open" },
        { column: "name", operator: "neq", value: "x" },
        { column: "amount", operator: "gt", value: "10" },
        { column: "amount", operator: "gte", value: "1.5" },
        { column: "created_at", operator: "lt", value: "2026-01-01" },
        { column: "closed", operator: "lte", value: "false" },
        { column: "company.name", operator: "eq", value: "Acme" },
      ],
    });
  });

  it("reads * as % in like and ilike patterns", async () => {
    await db().from("deals").select().like("name", "Ac*e%").ilike("name", "*corp");
    expect(sent().body).toMatchObject({
      filters: [
        { column: "name", operator: "like", value: "Ac%e%" },
        { column: "name", operator: "ilike", value: "%corp" },
      ],
    });
  });

  it("compiles in and is", async () => {
    await db()
      .from("deals")
      .select()
      .in("stage", ["open", "won"])
      .in("amount", [1, 2])
      .is("details", null)
      .is("closed", true)
      .is("archived", false);
    expect(sent().body).toMatchObject({
      filters: [
        { column: "stage", operator: "in", values: ["open", "won"] },
        { column: "amount", operator: "in", values: ["1", "2"] },
        { column: "details", operator: "is", value: "null" },
        { column: "closed", operator: "is", value: "true" },
        { column: "archived", operator: "is", value: "false" },
      ],
    });
  });

  it("negates one condition with not", async () => {
    await db()
      .from("deals")
      .select()
      .not("details", "is", null)
      .not("stage", "in", '(lost,"on hold")')
      .not("name", "like", "*test*");
    expect(sent().body).toMatchObject({
      filters: [
        { column: "details", operator: "is", value: "null", not: true },
        { column: "stage", operator: "in", values: ["lost", "on hold"], not: true },
        { column: "name", operator: "like", value: "%test%", not: true },
      ],
    });
  });

  it("adds one or group per call", async () => {
    await db()
      .from("deals")
      .select()
      .or("stage.eq.open,and(amount.gt.100,details.not.is.null)");
    expect(sent().body).toMatchObject({
      filters: [
        {
          or: [
            { column: "stage", operator: "eq", value: "open" },
            {
              and: [
                { column: "amount", operator: "gt", value: "100" },
                { column: "details", operator: "is", value: "null", not: true },
              ],
            },
          ],
        },
      ],
    });
  });

  it("appends order terms and sets limit, range and single", async () => {
    await db()
      .from("deals")
      .select()
      .order("amount", { ascending: false, nullsFirst: true })
      .order("name")
      .range(20, 29)
      .single();
    expect(sent().body).toEqual({
      table: "deals",
      select: "*",
      single: true,
      order: [{ column: "amount", ascending: false, nullsFirst: true }, { column: "name" }],
      offset: 20,
      limit: 10,
    });

    await db().from("deals").select().limit(5);
    expect(sent(1).body).toEqual({ table: "deals", select: "*", limit: 5 });
  });

  it("wraps one inserted object in rows and returns written rows only with select", async () => {
    answers.push(json(200, { rows: [] }), json(200, { rows: [{ id: 1 }], count: 1 }));
    const silent = await db().from("deals").insert({ name: "a" });
    expect(sent().url).toBe(`${URL}/storage/databases/${DATABASE}/rows/insert`);
    expect(sent().body).toEqual({ table: "deals", rows: [{ name: "a" }] });
    expect(silent).toEqual({ data: null, error: null, count: null, status: 200 });

    const written = await db()
      .from("deals")
      .insert([{ name: "a" }, { name: "b" }], { count: "exact", defaultToNull: false })
      .select("id");
    expect(sent(1).body).toEqual({
      table: "deals",
      rows: [{ name: "a" }, { name: "b" }],
      select: "id",
      count: "exact",
      defaultToNull: false,
    });
    expect(written).toEqual({ data: [{ id: 1 }], error: null, count: 1, status: 200 });
  });

  it("splits upsert onConflict on commas", async () => {
    await db()
      .from("deals")
      .upsert({ id: 1, name: "a" }, { onConflict: "owner_id, name", ignoreDuplicates: true })
      .select();
    expect(sent().url).toBe(`${URL}/storage/databases/${DATABASE}/rows/upsert`);
    expect(sent().body).toEqual({
      table: "deals",
      rows: [{ id: 1, name: "a" }],
      select: "*",
      onConflict: ["owner_id", "name"],
      ignoreDuplicates: true,
    });
  });

  it("sends update values and delete with their filters", async () => {
    await db().from("deals").update({ stage: "won" }, { count: "exact" }).eq("id", 7);
    expect(sent().url).toBe(`${URL}/storage/databases/${DATABASE}/rows/update`);
    expect(sent().body).toEqual({
      table: "deals",
      count: "exact",
      values: { stage: "won" },
      filters: [{ column: "id", operator: "eq", value: "7" }],
    });

    await db().from("deals").delete().in("id", [1, 2]).select("id").single();
    expect(sent(1).url).toBe(`${URL}/storage/databases/${DATABASE}/rows/delete`);
    expect(sent(1).body).toEqual({
      table: "deals",
      select: "id",
      single: true,
      filters: [{ column: "id", operator: "in", values: ["1", "2"] }],
    });
  });

  it("sends Json objects and arrays as JSON text", async () => {
    await db()
      .from("deals")
      .select()
      .eq("details", { tier: "gold" })
      .neq("details", [1])
      .in("details", [{ a: 1 }, "x"]);
    expect(sent().body).toMatchObject({
      filters: [
        { column: "details", operator: "eq", value: '{"tier":"gold"}' },
        { column: "details", operator: "neq", value: "[1]" },
        { column: "details", operator: "in", values: ['{"a":1}', "x"] },
      ],
    });
  });

  it("leaves the builder single and select start from as it was", async () => {
    const rows = db().from("deals").select("id");
    const one = rows.single();
    answers.push(json(200, { rows: [{ id: 1 }] }), json(200, { rows: [{ id: 1 }] }));
    expect((await rows).data).toEqual([{ id: 1 }]);
    expect((await one).data).toEqual({ id: 1 });
    expect(sent(0).body).toEqual({ table: "deals", select: "id" });
    expect(sent(1).body).toEqual({ table: "deals", select: "id", single: true });

    const write = db().from("deals").insert({ name: "x" });
    const returning = write.select("id");
    answers.push(json(200, { rows: [] }), json(200, { rows: [{ id: 1 }] }));
    expect((await write).data).toBeNull();
    expect((await returning).data).toEqual([{ id: 1 }]);
    expect(sent(2).body).toEqual({ table: "deals", rows: [{ name: "x" }] });
    expect(sent(3).body).toEqual({ table: "deals", select: "id", rows: [{ name: "x" }] });
  });

  it("removes whitespace after an escaped quote only outside quoted names", async () => {
    await db().from("deals").select('id, "a\\" b"');
    expect(sent().body).toEqual({ table: "deals", select: 'id,"a\\" b"' });
  });

  it("targets another database with the same key", async () => {
    await db().database("db-2").from("deals").select();
    expect(sent().url).toBe(`${URL}/storage/databases/db-2/rows/select`);
  });
});

describe("transport", () => {
  it("sends only the bearer key and the JSON content type", async () => {
    await db().from("deals").select();
    expect(sent().headers).toEqual({
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    });
  });

  it("sends one request per await and none before", async () => {
    const query = db().from("deals").select();
    expect(fetchMock).not.toHaveBeenCalled();
    await query;
    await query;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends a refused write once", async () => {
    answers.push(json(500, { message: "boom", slug: "internal-error" }));
    const result = await db().from("deals").insert({ name: "a" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      data: null,
      error: { message: "boom", code: "internal-error", hints: [] },
      count: null,
      status: 500,
    });
  });
});

describe("answers", () => {
  it("answers rows, the count and the one row of single", async () => {
    answers.push(
      json(200, { rows: [{ id: 1 }, { id: 2 }], count: 2 }),
      json(200, { rows: [{ id: 1 }] }),
    );
    expect(await db().from("deals").select("id", { count: "exact" })).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      error: null,
      count: 2,
      status: 200,
    });
    expect(await db().from("deals").select("id").eq("id", 1).single()).toEqual({
      data: { id: 1 },
      error: null,
      count: null,
      status: 200,
    });
  });

  it("maps a refusal to its status, slug, message and hints", async () => {
    answers.push(
      json(404, {
        message: "no access",
        slug: "storage-database-access-denied",
        hints: ["ask the owner"],
      }),
    );
    expect(await db().from("deals").select()).toEqual({
      data: null,
      error: {
        message: "no access",
        code: "storage-database-access-denied",
        hints: ["ask the owner"],
      },
      count: null,
      status: 404,
    });
  });

  it("maps a refusal without an OAIZ body to its status and an empty code", async () => {
    answers.push({ status: 502, body: "<html>bad gateway</html>", contentType: "text/html" });
    const result = await db().from("deals").select();
    expect(result.status).toBe(502);
    expect(result.error).toEqual({ message: "HTTP 502", code: "", hints: [] });
  });

  it("maps a rejected fetch and a timeout to status 0", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await db().from("deals").select()).toEqual({
      data: null,
      error: { message: "fetch failed", code: "", hints: [] },
      count: null,
      status: 0,
    });

    fetchMock.mockRejectedValueOnce(new DOMException("The operation was aborted.", "AbortError"));
    const timedOut = await db().from("deals").select();
    expect(timedOut.status).toBe(0);
    expect(timedOut.error?.code).toBe("");
  });

  it("maps an undecodable answer to status 0", async () => {
    answers.push({ status: 200, body: "not json", contentType: "application/json" });
    const result = await db().from("deals").select();
    expect(result.status).toBe(0);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("");
  });

  it("refuses a write with parts its request cannot carry without sending anything", async () => {
    const results = [
      // @ts-expect-error an insert takes no filters
      await db().from("deals").insert({ name: "a" }).eq("id", 1),
      // @ts-expect-error an upsert takes no filters
      await db().from("deals").upsert({ name: "a" }).or("id.eq.1"),
      // @ts-expect-error an update takes no limit
      await db().from("deals").update({ stage: "won" }).eq("id", 1).limit(1),
      // @ts-expect-error an update takes no order
      await db().from("deals").update({ stage: "won" }).eq("id", 1).order("id"),
      // @ts-expect-error a delete takes no range
      await db().from("deals").delete().eq("id", 1).range(0, 0),
    ];
    expect(fetchMock).not.toHaveBeenCalled();
    for (const result of results) {
      expect(result.status).toBe(400);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("storage-table-request-invalid");
    }
  });

  it("refuses a limit or range that is not a whole number of rows without sending anything", async () => {
    const results = [
      await db().from("deals").select().limit(Number.NaN),
      await db().from("deals").select().limit(Number.POSITIVE_INFINITY),
      await db().from("deals").select().limit(-1),
      await db().from("deals").select().limit(1.5),
      await db().from("deals").select().range(0, Number.NaN),
      await db().from("deals").select().range(-1, 3),
      await db().from("deals").select().range(5, 2),
    ];
    expect(fetchMock).not.toHaveBeenCalled();
    for (const result of results) {
      expect(result.status).toBe(400);
      expect(result.error?.code).toBe("storage-table-request-invalid");
    }

    await db().from("deals").select().limit(0).range(3, 3);
    expect(sent().body).toEqual({ table: "deals", select: "*", offset: 3, limit: 1 });
  });

  it("refuses a filter string that does not parse without sending anything", async () => {
    const results = [
      await db().from("deals").select().or("stage.eq.open,and(amount.gt.1"),
      // @ts-expect-error an operator the type does not name still reaches the runtime check
      await db().from("deals").select().not("stage", "between", "1"),
    ];
    expect(fetchMock).not.toHaveBeenCalled();
    for (const result of results) {
      expect(result.status).toBe(400);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("storage-table-request-invalid");
    }
  });
});

describe("rpc", () => {
  it("calls the function route with the name alone when no arguments are given", async () => {
    answers.push(json(200, { data: 3 }));
    expect(await db().rpc("task_count")).toEqual({ data: 3, error: null, count: null, status: 200 });
    const request = sent();
    expect(request.url).toBe(`${URL}/storage/databases/${DATABASE}/functions/call`);
    expect(request.body).toEqual({ name: "task_count" });
    expect(Object.keys(request.body as object)).toEqual(["name"]);
  });

  it("sends the arguments by name and answers rows, objects and void as they come", async () => {
    answers.push(
      json(200, { data: [{ id: "t1", title: "Draft" }] }),
      json(200, { data: { a: 1, z: "last" } }),
      json(200, { data: null }),
      json(200, {}),
    );
    expect(await db().rpc("my_tasks", { p_limit: 5, p_done: false })).toEqual({
      data: [{ id: "t1", title: "Draft" }],
      error: null,
      count: null,
      status: 200,
    });
    expect(sent().body).toEqual({ name: "my_tasks", args: { p_limit: 5, p_done: false } });
    expect((await db().rpc("sample", {})).data).toEqual({ a: 1, z: "last" });
    expect(sent(1).body).toEqual({ name: "sample", args: {} });
    expect(await db().rpc("nothing")).toEqual({ data: null, error: null, count: null, status: 200 });
    // An answer without data reads as null too.
    expect((await db().rpc("nothing")).data).toBeNull();
  });

  it("calls the function of the database the client is on", async () => {
    await db().database("db-2").rpc("task_count");
    expect(sent().url).toBe(`${URL}/storage/databases/db-2/functions/call`);
  });

  // Core's function call error messages, word for word.
  it.each([
    [404, "storage-function-not-found", "not-found: the function add_task does not exist in the database"],
    [403, "storage-database-edit-required", "forbidden: editing this database requires edit access"],
    [400, "storage-function-call-invalid", "incorrect-input: the function add_task requires argument p_title"],
  ])("maps a %i %s refusal to its status, slug and message", async (status, slug, message) => {
    answers.push(json(status, { message, slug }));
    expect(await db().rpc("add_task")).toEqual({
      data: null,
      error: { message, code: slug, hints: [] },
      count: null,
      status,
    });
  });
});
