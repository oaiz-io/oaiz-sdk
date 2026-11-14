import { readFileSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { openTestDatabase } from "../../testmode/database";
import { parseMembers } from "../../testmode/members";
import { createTestServer, type OaizTestServer } from "../../testmode/server";
import { testFolder, type TestFolder } from "../fixtures/testmode-folder";

const schemaSQL = readFileSync(new URL("../fixtures/rowcontract/test_schema.sql", import.meta.url), "utf8");

// Core's rendering of a database that installs every managed extension and uses each one.
const extensionSchemaSQL = readFileSync(
  new URL("../fixtures/extensioncontract/test_schema.sql", import.meta.url),
  "utf8",
);

// Core's admission results for that database; raw requests remain unsupported in test mode.
const extensionSQLContract: {
  accepted: { sql: string; rows: string[][] };
  refused: { sql: string; slug: string }[];
  indexes: { sql: string; slug: string }[];
} = JSON.parse(
  readFileSync(new URL("../fixtures/extensioncontract/sql_admission.json", import.meta.url), "utf8"),
);

const ADA = "7e570000-0000-4000-8000-0000000000b1";
const APP = "7e570000-0000-4000-8000-0000000000a1";
const DB = "7e570000-0000-4000-8000-0000000000d1";
const OTHER = "7e570000-0000-4000-8000-0000000000d2";

const members = JSON.stringify({
  members: [{ id: ADA, name: "Ada Lovelace", email: "ada@example.test" }],
});

// The seed gives no ids, so the rows number 1, 2 on every reset.
const seedSQL = `INSERT INTO data.projects (name) VALUES ('Launch'), ('Pipeline');\n`;

function rowsRequest(
  server: OaizTestServer,
  operation: string,
  body: unknown,
  token = server.issueToken(ADA, APP),
  database = DB,
) {
  return server.handle(
    new Request(`http://app.example.test:4381/__oaiz-test/storage/databases/${database}/rows/${operation}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function functionCall(
  server: OaizTestServer,
  body: unknown,
  token = server.issueToken(ADA, APP),
  database = DB,
) {
  return server.handle(
    new Request(`http://app.example.test:4381/__oaiz-test/storage/databases/${database}/functions/call`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function projectNames(server: OaizTestServer, database = DB): Promise<string[]> {
  const response = await rowsRequest(
    server,
    "select",
    { table: "projects", select: "name", order: [{ column: "id" }] },
    undefined,
    database,
  );
  expect(response.status, await response.clone().text()).toBe(200);
  const { rows } = (await response.json()) as { rows: { name: string }[] };
  return rows.map((row) => row.name);
}

/** A test server on a new folder of files; dispose closes both. */
async function serve(files: Record<string, string>) {
  const folder = await testFolder({ "members.json": members, ...files });
  const server = await createTestServer({ directory: folder.directory });
  return {
    folder,
    server,
    async dispose() {
      await server.close();
      await folder.dispose();
    },
  };
}

describe("a function that fails when it runs", () => {
  // Written after the schema's RESET ROLE, so the functions get their grants here.
  const mistakesSQL = `
CREATE FUNCTION data.no_return() RETURNS integer LANGUAGE plpgsql STABLE
  SET search_path = data, extensions, pg_temp AS $$ BEGIN NULL; END $$;
CREATE FUNCTION data.no_branch(p integer) RETURNS integer LANGUAGE plpgsql STABLE
  SET search_path = data, extensions, pg_temp
  AS $$ BEGIN CASE p WHEN 1 THEN RETURN 1; END CASE; RETURN 0; END $$;
GRANT EXECUTE ON FUNCTION data.no_return(), data.no_branch(integer) TO oaiz_test_read, oaiz_test_write;
`;

  it("answers the caller with the statement's own error, as Core does", async () => {
    const { server, dispose } = await serve({ [`databases/${DB}.sql`]: schemaSQL + mistakesSQL });
    try {
      const unreturned = await functionCall(server, { name: "no_return" });
      expect(unreturned.status).toBe(400);
      expect(await unreturned.json()).toEqual({
        message:
          "incorrect-input: control reached end of function without RETURN (sqlstate 2F005)",
        slug: "storage-customer-sql-failed",
      });

      const unmatched = await functionCall(server, { name: "no_branch", args: { p: 2 } });
      expect(unmatched.status).toBe(400);
      const body = (await unmatched.json()) as { message: string; slug: string };
      expect(body.slug).toBe("storage-customer-sql-failed");
      expect(body.message).toContain("case not found (sqlstate 20000)");
    } finally {
      await dispose();
    }
  }, 60_000);
});

describe("test server", () => {
  let server: OaizTestServer;

  let folder: TestFolder;

  beforeAll(async () => {
    folder = await testFolder({
      "members.json": members,
      [`databases/${DB}.sql`]: schemaSQL,
      [`databases/${DB}.seed.sql`]: seedSQL,
    });
    server = await createTestServer({ directory: folder.directory });
    // The first request opens the database.
    await projectNames(server);
  }, 60_000);

  afterAll(async () => {
    await server.close();
    await folder.dispose();
  });

  it("puts the seed rows back on reset", async () => {
    await rowsRequest(server, "delete", {
      table: "projects",
      filters: [{ column: "id", operator: "eq", value: "2" }],
    });
    expect(await projectNames(server)).toEqual(["Launch"]);
    await server.reset();
    expect(await projectNames(server)).toEqual(["Launch", "Pipeline"]);
  });

  it("gives an inserted row the identity value after the seed's rows", async () => {
    await server.reset();
    const response = await rowsRequest(server, "insert", {
      table: "projects",
      rows: [{ name: "Hiring" }],
      select: "id, name",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows: [{ id: 3, name: "Hiring" }] });
  });

  it.each([
    ["POST", "/__oaiz-test/ingest/tools/run"],
    ["POST", "/__oaiz-test/ingest/event"],
    ["POST", "/__oaiz-test/ingest/llm/call"],
    ["POST", "/__oaiz-test/internalagents/chat/conversations"],
    ["GET", "/__oaiz-test/storage/sql"],
  ])("answers %s %s as unsupported", async (method, path) => {
    const response = await server.handle(new Request(`http://app.example.test:4381${path}`, { method }));
    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({
      slug: "test-mode-unsupported",
      message:
        "OAIZ test mode runs sign-in, row requests and function calls only. Tools, events, workflow runs, model calls, embeddings and chat need OAIZ.",
    });
  });

  it.each(["rows/select", "functions/call"])(
    "answers %s called with another method than POST as Core's router does",
    async (route) => {
      const response = await server.handle(
        new Request(`http://app.example.test:4381/__oaiz-test/storage/databases/${DB}/${route}`),
      );
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("404 page not found");
    },
  );

  it("calls a function as the member and answers what it returned", async () => {
    await server.reset();
    const added = await functionCall(server, { name: "add_task", args: { p_title: "Draft" } });
    expect(added.status, await added.clone().text()).toBe(200);
    expect(await added.text()).toBe('{"data":1}');

    const listed = await functionCall(server, { name: "my_tasks", args: { p_limit: 5 } });
    expect(listed.status, await listed.clone().text()).toBe(200);
    expect(await listed.json()).toMatchObject({ data: [{ id: 1, owner_id: ADA, title: "Draft" }] });

    const counted = await functionCall(server, { name: "task_count" });
    expect(await counted.text()).toBe('{"data":1}');
  });

  it("refuses a function call body before it looks the database up, as Core does", async () => {
    const response = await functionCall(
      server,
      { name: "task_count", schema: "data" },
      undefined,
      OTHER,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      slug: "invalid-input",
      message: "Invalid JSON input",
      errors: [{ field: "json", message: 'Invalid JSON format: json: unknown field "schema"' }],
    });
  });

  it.each([
    [
      { name: "a".repeat(64) },
      400,
      "storage-function-call-invalid",
      "incorrect-input: the function name is longer than a PostgreSQL identifier",
    ],
    [{ name: "oaiz_subject" }, 404, "storage-function-not-found", undefined],
    [
      {
        name: "task_count",
        args: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`p_${i}`, i])),
      },
      400,
      "storage-function-call-invalid",
      "incorrect-input: a function call passes at most 100 arguments",
    ],
  ])(
    "refuses a call no function can answer before it looks the database up, as Core does",
    async (body, status, slug, message) => {
      const response = await functionCall(server, body, undefined, OTHER);
      expect(response.status).toBe(status);
      const answer = (await response.json()) as { slug: string; message: string };
      expect(answer.slug).toBe(slug);
      if (message !== undefined) expect(answer.message).toBe(message);
    },
  );

  it("runs concurrent requests one transaction at a time, so a failing one rolls back alone", async () => {
    await server.reset();
    const names = ["One", "Two", "Three", "Four", "Five", "Six"];
    const answers = await Promise.all([
      ...names.map((name) =>
        rowsRequest(server, "insert", { table: "projects", rows: [{ name }] }),
      ),
      rowsRequest(server, "insert", { table: "projects", rows: [{ name: null }] }),
    ]);
    expect(answers.map((answer) => answer.status)).toEqual([...names.map(() => 200), 400]);
    expect((await projectNames(server)).sort()).toEqual(
      ["Launch", "Pipeline", ...names].sort(),
    );
  });

  it.each([
    ["an empty body", "", { message: "EOF", slug: "invalid-input" }],
    ["a truncated body", '{"table":', { message: "unexpected EOF", slug: "invalid-input" }],
    [
      "a body that is not JSON",
      '{"table":"projects" x}',
      { message: "invalid character 'x' after object key:value pair", slug: "invalid-input" },
    ],
    [
      "a body that is not an object",
      "[]",
      {
        message: "Invalid JSON input",
        slug: "invalid-input",
        errors: [
          {
            field: "json",
            message:
              "Invalid JSON format: json: cannot unmarshal array into Go value of type dto.wire",
          },
        ],
      },
    ],
  ])("refuses %s as Core's binding does", async (_, body, answer) => {
    const response = await server.handle(
      new Request(`http://app.example.test:4381/__oaiz-test/storage/databases/${DB}/rows/select`, {
        method: "POST",
        headers: { authorization: `Bearer ${server.issueToken(ADA, APP)}` },
        body,
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(answer);
  });

  it("pages past the last row at the largest offset Core takes", async () => {
    await server.reset();
    const response = await server.handle(
      new Request(`http://app.example.test:4381/__oaiz-test/storage/databases/${DB}/rows/select`, {
        method: "POST",
        headers: { authorization: `Bearer ${server.issueToken(ADA, APP)}` },
        body: '{"table":"projects","offset":9223372036854775807}',
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows: [] });
  });

  it("refuses a request without a bearer token as Core does", async () => {
    const response = await server.handle(
      new Request(`http://app.example.test:4381/__oaiz-test/storage/databases/${DB}/rows/select`, {
        method: "POST",
        body: JSON.stringify({ table: "projects" }),
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect(await response.json()).toEqual({
      message: "Authorization header not provided",
      slug: "no-authorization-header",
    });
  });

  it("refuses a token the test mode did not issue as Core does", async () => {
    const response = await rowsRequest(server, "select", { table: "projects" }, "not-a-token");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe('Bearer error="invalid_token"');
    expect(await response.json()).toEqual({
      message: "authentication: Invalid token",
      slug: "invalid-token",
    });
  });
});

describe("test server on columns PGlite does not take text for", () => {
  let served: Awaited<ReturnType<typeof serve>>;
  let server: OaizTestServer;

  beforeAll(async () => {
    served = await serve({
      [`databases/${DB}.sql`]: `${schemaSQL}
ALTER TABLE "data"."projects" ADD COLUMN "archived" boolean NOT NULL DEFAULT false;
ALTER TABLE "data"."tasks" ALTER CONSTRAINT "tasks_project_id_fkey" DEFERRABLE INITIALLY DEFERRED;
`,
      [`databases/${DB}.seed.sql`]: `INSERT INTO data.projects (name) VALUES ('Launch');
INSERT INTO data.tasks (project_id, owner_id, title) VALUES (1, '${ADA}', 'Plan');
INSERT INTO data.notes (task_id, attachment) VALUES (1, '\\x0102');
`,
    });
    server = served.server;
    await rowsRequest(server, "select", { table: "projects" });
  }, 60_000);

  afterAll(async () => {
    await served.dispose();
  });

  it("reads a bytea filter value as PostgreSQL reads its text", async () => {
    const response = await rowsRequest(server, "select", {
      table: "notes",
      select: "id",
      filters: [{ column: "attachment", operator: "eq", value: "\\x0102" }],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows: [{ id: 1 }] });
  });

  it("reads a boolean filter value as PostgreSQL reads its text, and refuses one it cannot", async () => {
    const matching = await rowsRequest(server, "select", {
      table: "projects",
      select: "id",
      filters: [{ column: "archived", operator: "eq", value: "fa" }],
    });
    expect(matching.status).toBe(200);
    expect(await matching.json()).toEqual({ rows: [{ id: 1 }] });

    const refused = await rowsRequest(server, "select", {
      table: "projects",
      filters: [{ column: "archived", operator: "eq", value: "maybe" }],
    });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({
      message:
        'incorrect-input: invalid input syntax for type boolean: "maybe" (sqlstate 22P02)',
      slug: "storage-customer-sql-failed",
    });
  });

  it("answers a write that fails at commit as Core's write completion does", async () => {
    const response = await rowsRequest(server, "insert", {
      table: "tasks",
      rows: [{ project_id: 99, owner_id: ADA, title: "Orphan" }],
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      message: "external-service: failed to complete the bounded transaction (sqlstate 23503)",
      slug: "storage-bounded-transaction-failed",
    });
  });
});

const documentsSeedSQL = `INSERT INTO data.documents (title, author_email, attributes, path, label_ids, embedding) VALUES
  ('Crème brûlée', 'Ada@Example.test', 'tier => gold', 'kitchen.desserts', '{1,2,3}', '[1,0,0]'),
  ('Launch plan', 'grace@example.test', NULL, 'work.plans', '{3,4}', '[0,1,0]');
`;

it.each(extensionSQLContract.indexes)(
  "refuses $sql in local schema files",
  async ({ sql, slug }) => {
    await expect(openTestDatabase(extensionSchemaSQL + ";" + sql, "the local extension schema"))
      .rejects.toMatchObject({
        status: 400,
        slug,
        message: "incorrect-input: IVFFlat indexes are refused; use HNSW for a supported vector index",
      });
  },
  60_000,
);

/** An index access method that implements IVFFlat under another name. */
const aliasedIVFFlatSQL = `CREATE ACCESS METHOD alternate_ivf TYPE INDEX HANDLER extensions.ivfflathandler;
CREATE OPERATOR CLASS extensions.alternate_vector_ops DEFAULT FOR TYPE extensions.vector USING alternate_ivf AS
  OPERATOR 1 extensions.<-> (extensions.vector, extensions.vector) FOR ORDER BY float_ops,
  FUNCTION 1 extensions.vector_l2_squared_distance(extensions.vector, extensions.vector),
  FUNCTION 3 extensions.l2_distance(extensions.vector, extensions.vector);
CREATE INDEX documents_alternate_ivf ON data.documents USING alternate_ivf (embedding extensions.alternate_vector_ops);`;

it("refuses an IVFFlat index under another access method name in local schema and seed files", async () => {
  const refusal = {
    status: 400,
    slug: "storage-vector-index-refused",
    message: "incorrect-input: IVFFlat indexes are refused; use HNSW for a supported vector index",
  };
  await expect(
    openTestDatabase(extensionSchemaSQL + ";" + aliasedIVFFlatSQL, "the local extension schema"),
  ).rejects.toMatchObject(refusal);
  const seeded = await openTestDatabase(extensionSchemaSQL, "the extension contract schema");
  try {
    await expect(seeded.reset(aliasedIVFFlatSQL)).rejects.toMatchObject(refusal);
  } finally {
    await seeded.close();
  }
}, 60_000);

describe("test database with every managed extension", () => {
  let database: Awaited<ReturnType<typeof openTestDatabase>>;

  /** The first value of sql's first row, read on the search path a customer statement runs on. */
  const one = (sql: string, args: string[] = []) =>
    database.exclusive(async (session) => {
      await session.exec("SET search_path TO data, extensions, pg_temp");
      const rows = await session.query(sql, args);
      return rows[0]?.[0];
    });

  beforeAll(async () => {
    database = await openTestDatabase(extensionSchemaSQL, "the extension contract schema");
    await database.reset(documentsSeedSQL);
  }, 60_000);

  afterAll(async () => {
    await database.close();
  });

  it("refuses an IVFFlat index in a local seed and all work queued behind it", async () => {
    const refused = await openTestDatabase(extensionSchemaSQL, "the extension contract schema");
    try {
      const reset = refused.reset(`BEGIN;
CREATE INDEX documents_ivf ON data.documents USING ivfflat (embedding extensions.vector_cosine_ops);
INSERT INTO data.documents (title, author_email) VALUES ('stale', 'ada@example.test');
COMMIT;`);
      let read = false;
      const queued = refused.exclusive(async () => {
        read = true;
      });
      await expect(reset).rejects.toMatchObject({
        status: 400,
        slug: "storage-vector-index-refused",
        message: "incorrect-input: IVFFlat indexes are refused; use HNSW for a supported vector index",
      });
      await expect(queued).rejects.toThrow("the test database was discarded because its reset failed");
      expect(read).toBe(false);
    } finally {
      await refused.close();
    }
  }, 60_000);

  it("applies numeric SET LOCAL constants transactionally on the extension schema", async () => {
    await database.exclusive(async (session) => {
      const before = await session.query(
        "SELECT current_setting('hnsw.ef_search'), current_setting('pg_trgm.similarity_threshold')",
        [],
      );
      await session.exec(
        "BEGIN; SET LOCAL hnsw.ef_search = 100; SET LOCAL hnsw.max_scan_tuples TO 100000; SET LOCAL pg_trgm.similarity_threshold = 0.4; SET LOCAL pg_trgm.word_similarity_threshold = 0; SET LOCAL pg_trgm.strict_word_similarity_threshold = 1;",
      );
      try {
        expect(
          await session.query(
            "SELECT current_setting('hnsw.ef_search'), current_setting('hnsw.max_scan_tuples'), current_setting('pg_trgm.similarity_threshold'), current_setting('pg_trgm.word_similarity_threshold'), current_setting('pg_trgm.strict_word_similarity_threshold')",
            [],
          ),
        ).toEqual([["100", "100000", "0.4", "0", "1"]]);
      } finally {
        await session.exec("ROLLBACK");
      }
      expect(
        await session.query(
          "SELECT current_setting('hnsw.ef_search'), current_setting('pg_trgm.similarity_threshold')",
          [],
        ),
      ).toEqual(before);
    });
  });

  it("installs the twelve extensions the schema names", async () => {
    expect(
      await one(
        "SELECT string_agg(e.extname, ',' ORDER BY e.extname) FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE n.nspname = 'extensions'",
      ),
    ).toBe(
      "btree_gin,btree_gist,citext,fuzzystrmatch,hstore,intarray,ltree,pg_trgm,pgcrypto,unaccent,uuid-ossp,vector",
    );
  });

  it.each([
    ["vector orders by distance", "SELECT title FROM documents ORDER BY embedding <-> $1 LIMIT 1", ["[0,0.9,0]"], "Launch plan"],
    ["pg_trgm scores similarity", "SELECT (similarity(title, $1) > 0.5)::text FROM documents WHERE title = 'Launch plan'", ["Launch plans"], "true"],
    ["citext compares without case", "SELECT title FROM documents WHERE author_email = $1", ["ADA@example.TEST"], "Crème brûlée"],
    ["hstore reads a key", "SELECT attributes -> 'tier' FROM documents WHERE attributes IS NOT NULL", [], "gold"],
    ["ltree matches a descendant", "SELECT title FROM documents WHERE path <@ $1", ["work"], "Launch plan"],
    ["intarray intersects", "SELECT (label_ids & '{3,9}'::integer[])::text FROM documents WHERE title = 'Launch plan'", [], "{3}"],
    ["fuzzystrmatch fills a generated column", "SELECT title_sound FROM documents WHERE title = 'Launch plan'", [], "L521"],
    ["pgcrypto fills a generated column", "SELECT encode(title_digest, 'hex') FROM documents WHERE title = 'Launch plan'", [], "67d1dec15b5f7b73a8913c9a5acae1f57889a9ca609d86d95fd5071979343f51"],
    ["immutable_unaccent fills a generated column", "SELECT title_folded FROM documents WHERE title = 'Crème brûlée'", [], "creme brulee"],
    ["uuid-ossp fills the key", "SELECT (id::text ~ '^[0-9a-f-]{36}$')::text FROM documents LIMIT 1", [], "true"],
    ["btree_gist measures distance", "SELECT (1::integer <-> 4::integer)::text", [], "3"],
    ["btree_gin indexes a timestamp", "SELECT indexdef FROM pg_indexes WHERE indexname = 'documents_published_at'", [], "CREATE INDEX documents_published_at ON data.documents USING gin (published_at)"],
  ])("%s", async (_, sql, args, value) => {
    expect(await one(sql, args)).toBe(value);
  });
});

describe("test server on a database with every managed extension", () => {
  let served: Awaited<ReturnType<typeof serve>>;

  beforeAll(async () => {
    served = await serve({
      [`databases/${DB}.sql`]: extensionSchemaSQL,
      [`databases/${DB}.seed.sql`]: documentsSeedSQL,
    });
  }, 60_000);

  afterAll(async () => {
    await served.dispose();
  });

  it.each([
    ["query", "SELECT 1"],
    ["execute", "DELETE FROM documents"],
    ["query", extensionSQLContract.accepted.sql],
    ...extensionSQLContract.refused.map(({ sql }) => ["query", sql]),
    ["execute", "SET LOCAL hnsw.ef_search = 100; DELETE FROM documents"],
    ...extensionSQLContract.indexes.map(({ sql }) => ["migrations", sql]),
  ])("refuses unsupported raw %s requests explicitly: %s", async (route, sql) => {
    const { server } = served;
    const response = await server.handle(
      new Request(`http://app.example.test:4381/__oaiz-test/storage/databases/${DB}/${route}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${server.issueToken(ADA, APP)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ sql }),
      }),
    );
    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({
      slug: "test-mode-unsupported",
    });
  });

  it("filters a citext column without case and answers each extension type as Core does", async () => {
    const response = await rowsRequest(served.server, "select", {
      table: "documents",
      select: "author_email, attributes, path, label_ids, embedding, title_folded",
      filters: [{ column: "author_email", operator: "eq", value: "ADA@EXAMPLE.TEST" }],
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toEqual({
      rows: [
        {
          author_email: "Ada@Example.test",
          attributes: { tier: "gold" },
          path: "kitchen.desserts",
          label_ids: [1, 2, 3],
          embedding: "[1,0,0]",
          title_folded: "creme brulee",
        },
      ],
    });
  }, 60_000);

  it("writes hstore as its text form and reads it back as an object, as the generated types say", async () => {
    await served.server.reset();
    const response = await rowsRequest(served.server, "insert", {
      table: "documents",
      rows: [{ title: "Roadmap", author_email: "lin@example.test", attributes: '"tier"=>"silver", "region"=>NULL' }],
      select: "attributes",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toEqual({ rows: [{ attributes: { tier: "silver", region: null } }] });

    const object = await rowsRequest(served.server, "insert", {
      table: "documents",
      rows: [{ title: "Budget", author_email: "kim@example.test", attributes: { tier: "gold" } }],
    });
    expect(object.status).not.toBe(200);
  });
});

// Each answer below is the one Core's function call route gives, as Core's own function call tests
// pin them.
describe("test server on function shapes the row contract does not hold", () => {
  let served: Awaited<ReturnType<typeof serve>>;
  let server: OaizTestServer;

  beforeAll(async () => {
    served = await serve({
      [`databases/${DB}.sql`]: `${schemaSQL}
CREATE FUNCTION data.sample(OUT z text, OUT a bigint) LANGUAGE sql STABLE AS $$ SELECT 'last', 9007199254740993::bigint $$;
CREATE FUNCTION data.nothing() RETURNS void LANGUAGE sql STABLE AS $$ SELECT $$;
CREATE FUNCTION data.unnamed(integer) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT $1 $$;
CREATE FUNCTION data.total(VARIADIC p_values integer[]) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT 0 $$;
CREATE FUNCTION data.pick(p_value anyelement) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT 1 $$;
CREATE FUNCTION data.anything() RETURNS record LANGUAGE sql STABLE AS $$ SELECT 1, 2 $$;
CREATE FUNCTION data.twice(p_a integer) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT p_a $$;
CREATE FUNCTION data.twice(p_a text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT 1 $$;
`,
    });
    server = served.server;
    await functionCall(server, { name: "nothing" });
  }, 60_000);

  afterAll(async () => {
    await served.dispose();
  });

  it("answers one row of output columns as an object with sorted keys and every digit", async () => {
    const response = await functionCall(server, { name: "sample" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"data":{"a":9007199254740993,"z":"last"}}');
  });

  it.each([{ name: "nothing" }, { name: "nothing", args: {} }, { name: "nothing", args: null }])(
    "answers null data for a void function called with %j",
    async (body) => {
      const response = await functionCall(server, body);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('{"data":null}');
    },
  );

  it("refuses args that are not an object as Core's binding does", async () => {
    const response = await functionCall(server, { name: "sample", args: [1] });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      slug: "invalid-input",
      message: "Invalid JSON input",
      errors: [
        { field: "args", message: "Expected map[string]interface {} for field args, but got array" },
      ],
    });
  });

  it("refuses more than 100 arguments before it looks the function up, as Core's bound does", async () => {
    const args = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_, i) => [`p_${String(i).padStart(3, "0")}`, i]));
    const over = await functionCall(server, { name: "missing", args: args(101) });
    expect(over.status).toBe(400);
    expect(await over.json()).toEqual({
      slug: "storage-function-call-invalid",
      message: "incorrect-input: a function call passes at most 100 arguments",
    });
    const at = await functionCall(server, { name: "sample", args: args(100) });
    expect(at.status).toBe(400);
    expect(await at.json()).toEqual({
      slug: "storage-function-call-invalid",
      message: "incorrect-input: the function sample has no argument p_000",
    });
  });

  it.each([
    ["a".repeat(64), "the function name is longer than a PostgreSQL identifier"],
    ["unnamed", "the function unnamed has an input without a name"],
    ["total", "the function total takes VARIADIC input p_values"],
    ["pick", "the function pick takes input p_value of pseudo-type anyelement"],
    ["anything", "the function anything returns a type a call cannot read"],
    ["twice", "the database holds more than one function named twice"],
  ])("refuses a call of %s as a call Core cannot make", async (name, message) => {
    const response = await functionCall(server, { name, args: { p_a: 1 } });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      slug: "storage-function-call-invalid",
      message: `incorrect-input: ${message}`,
    });
  });
});

describe("test server on many databases", () => {
  it("answers each database id from its own files, and every other id as Core does without a grant", async () => {
    const served = await serve({
      [`databases/${DB}.sql`]: schemaSQL,
      [`databases/${DB}.seed.sql`]: seedSQL,
      [`databases/${OTHER}.sql`]: schemaSQL,
      [`databases/${OTHER}.seed.sql`]: `INSERT INTO data.projects (name) VALUES ('Hiring');\n`,
    });
    try {
      const { server } = served;
      expect(await projectNames(server, DB)).toEqual(["Launch", "Pipeline"]);
      expect(await projectNames(server, OTHER)).toEqual(["Hiring"]);

      const inserted = await rowsRequest(server, "insert", { table: "projects", rows: [{ name: "Payroll" }] }, undefined, OTHER);
      expect(inserted.status).toBe(200);
      expect(await projectNames(server, OTHER)).toEqual(["Hiring", "Payroll"]);
      expect(await projectNames(server, DB)).toEqual(["Launch", "Pipeline"]);

      // An id in capitals names the same files, as Core reads the id.
      expect(await projectNames(server, OTHER.toUpperCase())).toEqual(["Hiring", "Payroll"]);

      const unknown = await rowsRequest(server, "select", { table: "projects" }, undefined, "7e570000-0000-4000-8000-0000000000d9");
      expect(unknown.status).toBe(404);
      expect(await unknown.json()).toEqual({
        message: "the managed database was not found",
        slug: "storage-database-access-denied",
      });

      await server.reset();
      expect(await projectNames(server, OTHER)).toEqual(["Hiring"]);
    } finally {
      await served.dispose();
    }
  }, 60_000);

  it("reads the app's grant on each database from the members file, and gives edit to the rest", async () => {
    const served = await serve({
      "members.json": JSON.stringify({
        members: [{ id: ADA, name: "Ada Lovelace", email: "ada@example.test" }],
        grants: { [OTHER.toUpperCase()]: "view" },
      }),
      [`databases/${DB}.sql`]: schemaSQL,
      [`databases/${OTHER}.sql`]: schemaSQL,
      [`databases/${OTHER}.seed.sql`]: seedSQL,
    });
    try {
      const { server } = served;
      const refused = await rowsRequest(server, "insert", { table: "projects", rows: [{ name: "Hiring" }] }, undefined, OTHER);
      expect(refused.status).toBe(403);
      expect(((await refused.json()) as { slug: string }).slug).toBe(
        "storage-customer-sql-permission-denied",
      );
      expect(await projectNames(server, OTHER)).toEqual(["Launch", "Pipeline"]);

      const written = await rowsRequest(server, "insert", { table: "projects", rows: [{ name: "Hiring" }] }, undefined, DB);
      expect(written.status).toBe(200);
      expect(await projectNames(server, DB)).toEqual(["Hiring"]);
    } finally {
      await served.dispose();
    }
  }, 60_000);

  it("builds a database again on reset when its schema file changed, and drops one whose file is gone", async () => {
    const served = await serve({
      [`databases/${DB}.sql`]: schemaSQL,
      [`databases/${DB}.seed.sql`]: seedSQL,
      [`databases/${OTHER}.sql`]: schemaSQL,
    });
    try {
      const { folder, server } = served;
      expect(await projectNames(server, DB)).toEqual(["Launch", "Pipeline"]);
      expect(await projectNames(server, OTHER)).toEqual([]);

      await folder.write(
        `databases/${DB}.sql`,
        `${schemaSQL}\nALTER TABLE "data"."projects" ADD COLUMN "budget" bigint;\n`,
      );
      await folder.write(
        `databases/${DB}.seed.sql`,
        `INSERT INTO data.projects (name, budget) VALUES ('Launch', 5);\n`,
      );
      await folder.remove(`databases/${OTHER}.sql`);
      await server.reset();

      const budgets = await rowsRequest(server, "select", { table: "projects", select: "name, budget" });
      expect(budgets.status).toBe(200);
      expect(await budgets.json()).toEqual({ rows: [{ name: "Launch", budget: 5 }] });
      const gone = await rowsRequest(server, "select", { table: "projects" }, undefined, OTHER);
      expect(gone.status).toBe(404);
    } finally {
      await served.dispose();
    }
  }, 60_000);

  it("reads the members file again on reset", async () => {
    const served = await serve({});
    try {
      const { folder, server } = served;
      const grace = "7e570000-0000-4000-8000-0000000000b2";
      expect(() => server.issueToken(grace, APP)).toThrow(`tests/members.json has no member ${grace}`);

      await folder.write(
        "members.json",
        JSON.stringify({ members: [{ id: grace, name: "Grace Hopper", email: "grace@example.test" }] }),
      );
      await server.reset();
      const after = await rowsRequest(server, "select", { table: "projects" }, server.issueToken(grace, APP));
      expect(after.status).toBe(404);
    } finally {
      await served.dispose();
    }
  }, 60_000);

  it("opens a database on its first request, so a broken one leaves the others working", async () => {
    const served = await serve({
      [`databases/${DB}.sql`]: schemaSQL,
      [`databases/${DB}.seed.sql`]: seedSQL,
      [`databases/${OTHER}.sql`]: "CREATE TABL notes ();",
    });
    try {
      const { folder, server } = served;
      expect(await projectNames(server, DB)).toEqual(["Launch", "Pipeline"]);
      await server.reset();

      await expect(rowsRequest(server, "select", { table: "projects" }, undefined, OTHER)).rejects.toThrow(
        `tests/databases/${OTHER}.sql does not run on the test database: syntax error at or near "TABL"`,
      );
      expect(await projectNames(server, DB)).toEqual(["Launch", "Pipeline"]);

      // A fixed file builds on the next request, without a restart.
      await folder.write(`databases/${OTHER}.sql`, schemaSQL);
      await server.reset();
      expect(await projectNames(server, OTHER)).toEqual([]);
    } finally {
      await served.dispose();
    }
  }, 60_000);
});

describe("test files that are not what test mode reads", () => {
  it("names a hand-written schema file and the command that writes one", async () => {
    const served = await serve({ [`databases/${DB}.sql`]: "CREATE TABLE notes (id integer);" });
    try {
      await expect(rowsRequest(served.server, "select", { table: "notes" })).rejects.toThrow(
        `tests/databases/${DB}.sql creates no role oaiz_test_read, so it is not the output of \`oaiz db test-schema\`. ` +
          `Write the file with \`oaiz db test-schema <database-id> -o tests/databases/${DB}.sql\`; a hand-written CREATE TABLE file does not work.`,
      );
    } finally {
      await served.dispose();
    }
  }, 60_000);

  it("names the write role a schema file without it lacks", async () => {
    const served = await serve({ [`databases/${DB}.sql`]: "CREATE ROLE oaiz_test_read; CREATE TABLE notes (id integer);" });
    try {
      await expect(rowsRequest(served.server, "select", { table: "notes" })).rejects.toThrow(
        `tests/databases/${DB}.sql creates no role oaiz_test_write, so it is not the output of \`oaiz db test-schema\`.`,
      );
    } finally {
      await served.dispose();
    }
  }, 60_000);

  it("names the shape a members file holds", () => {
    expect(() => parseMembers("[]", "tests/members.json")).toThrow(
      'tests/members.json is not an object such as { "teams": [{ "id": "<uuid>", "name": "Sales" }], ',
    );
    expect(() => parseMembers('{ "members": ["ada@example.test"] }', "tests/members.json")).toThrow(
      'tests/members.json members[0] is not an object such as { "id": "<uuid>", "name": "Ada Lovelace", "email": "ada@example.test"',
    );
  });
});

describe("test server seed", () => {
  it("names the seed file that does not run on its database", async () => {
    const served = await serve({
      [`databases/${DB}.sql`]: schemaSQL,
      [`databases/${DB}.seed.sql`]: `INSERT INTO data.projects (name, budget) VALUES ('Launch', 5);\n`,
    });
    try {
      await expect(rowsRequest(served.server, "select", { table: "projects" })).rejects.toThrow(
        `tests/databases/${DB}.seed.sql does not run on its test database: column "budget" of relation "projects" does not exist`,
      );

      await served.folder.write(`databases/${DB}.seed.sql`, seedSQL);
      await served.server.reset();
      expect(await projectNames(served.server)).toEqual(["Launch", "Pipeline"]);

      await served.folder.write(`databases/${DB}.seed.sql`, "INSERT INTO data.nope VALUES (1);\n");
      await expect(served.server.reset()).rejects.toThrow(
        `tests/databases/${DB}.seed.sql does not run on its test database: relation "data.nope" does not exist`,
      );
    } finally {
      await served.dispose();
    }
  }, 60_000);

  it("builds a database again after its seed commits work the reset refuses", async () => {
    const served = await serve({
      [`databases/${DB}.sql`]: extensionSchemaSQL,
      [`databases/${DB}.seed.sql`]: documentsSeedSQL,
    });
    const titles = async () => {
      const response = await rowsRequest(served.server, "select", { table: "documents", select: "title" });
      expect(response.status, await response.clone().text()).toBe(200);
      return ((await response.json()) as { rows: unknown[] }).rows.length;
    };
    try {
      expect(await titles()).toBe(2);

      await served.folder.write(
        `databases/${DB}.seed.sql`,
        "BEGIN; CREATE INDEX documents_ivf ON data.documents USING ivfflat (embedding extensions.vector_cosine_ops); COMMIT;\n",
      );
      await expect(served.server.reset()).rejects.toMatchObject({ slug: "storage-vector-index-refused" });

      await served.folder.write(`databases/${DB}.seed.sql`, documentsSeedSQL);
      await served.server.reset();
      expect(await titles()).toBe(2);
    } finally {
      await served.dispose();
    }
  }, 60_000);

  it("refuses a seed file that has no schema file", async () => {
    const folder = await testFolder({ "members.json": members, [`databases/${DB}.seed.sql`]: seedSQL });
    try {
      await expect(createTestServer({ directory: folder.directory })).rejects.toThrow(
        `tests/databases/${DB}.seed.sql has no schema file tests/databases/${DB}.sql`,
      );
    } finally {
      await folder.dispose();
    }
  });

  it("runs any SQL the seed holds as the database superuser, row policies aside", async () => {
    const served = await serve({
      [`databases/${DB}.sql`]: schemaSQL,
      [`databases/${DB}.seed.sql`]: `INSERT INTO data.projects (name, team_id)
SELECT 'Project ' || n, NULL FROM generate_series(1, 3) AS n;
INSERT INTO data.readings (id) SELECT generate_series(1, 1001);
`,
    });
    try {
      expect(await projectNames(served.server)).toEqual(["Project 1", "Project 2", "Project 3"]);
      const count = await rowsRequest(served.server, "select", { table: "readings", select: "id", count: "exact", limit: 1 });
      expect(count.status, await count.clone().text()).toBe(200);
      expect(((await count.json()) as { count: number }).count).toBe(1001);
    } finally {
      await served.dispose();
    }
  }, 60_000);
});

describe("test server without databases", () => {
  it("answers an app with no databases folder as Core does without a grant", async () => {
    const served = await serve({});
    try {
      const response = await rowsRequest(served.server, "select", { table: "projects" });
      expect(response.status).toBe(404);
      expect(((await response.json()) as { slug: string }).slug).toBe("storage-database-access-denied");
    } finally {
      await served.dispose();
    }
  });

  it("answers every table of an empty schema file as missing, as Core does for an empty database", async () => {
    const served = await serve({ [`databases/${DB}.sql`]: "" });
    try {
      const response = await rowsRequest(served.server, "select", { table: "projects" });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        message: "incorrect-input: the table projects does not exist",
        slug: "storage-table-not-found",
      });
    } finally {
      await served.dispose();
    }
  }, 60_000);
});
