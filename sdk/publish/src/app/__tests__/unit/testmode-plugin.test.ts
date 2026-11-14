import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createServer, type Plugin, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { oaizTest } from "../../testmode/plugin";

function applies(plugin: Plugin, command: "serve" | "build", mode: string): boolean {
  const apply = plugin.apply;
  if (typeof apply !== "function") throw new Error("oaizTest's apply is not a function");
  return apply({}, { command, mode, isSsrBuild: false, isPreview: false });
}

describe("oaizTest", () => {
  it("applies only to the dev server in mode oaiz-test", () => {
    const plugin = oaizTest();
    expect(applies(plugin, "serve", "oaiz-test")).toBe(true);
    expect(applies(plugin, "build", "oaiz-test")).toBe(false);
    expect(applies(plugin, "build", "production")).toBe(false);
    expect(applies(plugin, "serve", "development")).toBe(false);
    expect(applies(plugin, "serve", "test")).toBe(false);
  });

  it("loads no PGlite module when the test entry is imported", async () => {
    vi.resetModules();
    const loaded = vi.fn();
    const modules = ["@electric-sql/pglite", "@electric-sql/pglite/contrib/citext", "@electric-sql/pglite-pgvector"];
    for (const name of modules) {
      vi.doMock(name, () => {
        loaded(name);
        return {};
      });
    }
    try {
      const entry = await import("../../testmode/index");
      expect(typeof entry.oaizTest).toBe("function");
      expect(typeof entry.createTestServer).toBe("function");
      expect(loaded).not.toHaveBeenCalled();
    } finally {
      for (const name of modules) {
        vi.doUnmock(name);
      }
    }
  });
});

const ADA = "7e570000-0000-4000-8000-0000000000b1";
const APP = "7e570000-0000-4000-8000-0000000000a1";
const VERIFIER = "v".repeat(43);
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");

const DB = "7e570000-0000-4000-8000-0000000000d1";

function membersFile(name: string): string {
  return JSON.stringify({ members: [{ id: ADA, name, email: "ada@example.test" }] });
}

describe("oaizTest on a Vite dev server", () => {
  let root: string;
  let server: ViteDevServer;
  let origin: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "oaiz-test-plugin-"));
    await mkdir(join(root, "tests", "databases"), { recursive: true });
    await writeFile(join(root, "tests", "members.json"), membersFile("Ada Lovelace"));
    await writeFile(join(root, "tests", "databases", `${DB}.sql`), "");
    await writeFile(join(root, "index.html"), "<!doctype html><title>app</title>\n");
    server = await createServer({
      root,
      configFile: false,
      mode: "oaiz-test",
      logLevel: "silent",
      plugins: [oaizTest()],
      server: { port: 0, strictPort: false, watch: null },
    });
    await server.listen();
    const local = server.resolvedUrls?.local[0];
    if (local === undefined) throw new Error("no dev server address");
    origin = new URL(local).origin;
  }, 60_000);

  afterAll(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  it("serves the issuer on the dev server's origin", async () => {
    const response = await fetch(`${origin}/__oaiz-test/oauth/.well-known/openid-configuration`);

    expect(response.status).toBe(200);
    expect(((await response.json()) as { issuer: string }).issuer).toBe(
      `${origin}/__oaiz-test/oauth`,
    );
  }, 60_000);

  it("answers rows from the database files under tests/", async () => {
    const page = await fetch(`${origin}/__oaiz-test/oauth/authorize?${authorizeQuery()}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain(">Ada Lovelace</button>");

    const approval = await fetch(`${origin}/__oaiz-test/oauth/authorize`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `${authorizeQuery()}&member=${ADA}`,
      redirect: "manual",
    });
    expect(approval.status).toBe(303);
    const code = new URL(approval.headers.get("location") ?? "").searchParams.get("code") ?? "";
    const tokens = await fetch(`${origin}/__oaiz-test/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin}/`,
        client_id: APP,
        code_verifier: VERIFIER,
      }),
    });
    expect(tokens.status).toBe(200);
    const { access_token } = (await tokens.json()) as { access_token: string };

    const rows = await fetch(`${origin}/__oaiz-test/storage/databases/${DB}/rows/select`, {
      method: "POST",
      headers: { authorization: `Bearer ${access_token}`, "content-type": "application/json" },
      body: JSON.stringify({ table: "tasks", select: "id" }),
    });
    expect(((await rows.json()) as { slug: string }).slug).toBe("storage-table-not-found");
  }, 60_000);

  it("reads the members file again on a reset request", async () => {
    await writeFile(join(root, "tests", "members.json"), membersFile("Ada Byron"));

    const reset = await fetch(`${origin}/__oaiz-test/test/reset`, { method: "POST" });
    expect(reset.status).toBe(204);

    const page = await fetch(`${origin}/__oaiz-test/oauth/authorize?${authorizeQuery()}`);
    expect(await page.text()).toContain(">Ada Byron</button>");
  });

  it("answers a reset whose seed does not run with the seed file's error", async () => {
    await writeFile(join(root, "tests", "databases", `${DB}.seed.sql`), "INSERT INTO data.nope VALUES (1);\n");
    await fetch(`${origin}/__oaiz-test/storage/databases/${DB}/rows/select`, { method: "POST" });

    const logged = vi.spyOn(server.config.logger, "error");
    const reset = await fetch(`${origin}/__oaiz-test/test/reset`, { method: "POST" });
    const message = `tests/databases/${DB}.seed.sql does not run on its test database: relation "data.nope" does not exist`;
    expect(reset.status).toBe(500);
    expect(reset.headers.get("content-type")).toBe("application/json");
    expect(await reset.json()).toEqual({ message, slug: "test-mode-setup" });
    expect(logged).toHaveBeenCalledWith(`[oaiz-test] ${message}`, { timestamp: true });
    logged.mockRestore();

    await writeFile(join(root, "tests", "databases", `${DB}.seed.sql`), "");
    expect((await fetch(`${origin}/__oaiz-test/test/reset`, { method: "POST" })).status).toBe(204);
 }, 60_000);

  it("answers other test-mode paths as unsupported, and leaves the app's own paths to Vite", async () => {
    const tools = await fetch(`${origin}/__oaiz-test/ingest/tools/storage_query/run`, {
      method: "POST",
    });
    expect(tools.status).toBe(501);
    expect(((await tools.json()) as { slug: string }).slug).toBe("test-mode-unsupported");

    const app = await fetch(`${origin}/`);
    expect(app.status).toBe(200);
    expect(await app.text()).toContain("<title>app</title>");
  });

  function authorizeQuery(): string {
    return new URLSearchParams({
      response_type: "code",
      client_id: APP,
      redirect_uri: `${origin}/`,
      state: "state-1",
      code_challenge: CHALLENGE,
      code_challenge_method: "S256",
    }).toString();
  }
});
