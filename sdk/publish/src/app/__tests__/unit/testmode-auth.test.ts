import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createClient } from "../../index";
import { createTestServer, type OaizTestServer } from "../../testmode/server";
import { testFolder, type TestFolder } from "../fixtures/testmode-folder";

const schemaSQL = readFileSync(new URL("../fixtures/rowcontract/test_schema.sql", import.meta.url), "utf8");

const ORIGIN = "http://app.example.test:4381";
const ISSUER = `${ORIGIN}/__oaiz-test/oauth`;
const ADA = "7e570000-0000-4000-8000-0000000000b1";
const GRACE = "7e570000-0000-4000-8000-0000000000b2";
const APP = "7e570000-0000-4000-8000-0000000000a1";
const PAGE = `${ORIGIN}/tasks?tab=open`;
const VERIFIER = "v".repeat(43);
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");

const DB = "7e570000-0000-4000-8000-0000000000d1";

let folder: TestFolder;
let server: OaizTestServer;

beforeAll(async () => {
  folder = await testFolder({
    "members.json": JSON.stringify({
      members: [
        { id: ADA, name: "Ada Lovelace", email: "ada@example.test" },
        { id: GRACE, name: "Grace <Hopper> & co", email: "grace@example.test" },
      ],
    }),
    [`databases/${DB}.sql`]: schemaSQL,
    [`databases/${DB}.seed.sql`]: "INSERT INTO data.projects (name) VALUES ('Launch');\n",
  });
  server = await createTestServer({ directory: folder.directory });
  // The first request opens the database.
  expect((await selectProjects(server.issueToken(ADA, APP))).status).toBe(200);
}, 60_000);

afterAll(async () => {
  await server.close();
  await folder.dispose();
});

function get(path: string, headers: Record<string, string> = {}): Promise<Response> {
  return server.handle(new Request(`${ORIGIN}${path}`, { headers }));
}

function post(path: string, form: Record<string, string>): Promise<Response> {
  return server.handle(
    new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    }),
  );
}

function authorizeQuery(overrides: Record<string, string> = {}): string {
  return new URLSearchParams({
    response_type: "code",
    client_id: APP,
    redirect_uri: PAGE,
    scope: "openid email profile",
    state: "state-1",
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    ...overrides,
  }).toString();
}

/** Approves the sign-in as member and returns the code the redirect carries. */
async function approve(member: string): Promise<string> {
  const response = await post("/__oaiz-test/oauth/authorize", {
    ...Object.fromEntries(new URLSearchParams(authorizeQuery())),
    member,
  });
  expect(response.status).toBe(303);
  const back = new URL(response.headers.get("location") ?? "");
  expect(back.origin + back.pathname).toBe(`${ORIGIN}/tasks`);
  expect(back.searchParams.get("tab")).toBe("open");
  expect(back.searchParams.get("state")).toBe("state-1");
  expect(back.searchParams.get("iss")).toBe(ISSUER);
  return back.searchParams.get("code") ?? "";
}

function redeem(code: string, verifier = VERIFIER): Promise<Response> {
  return post("/__oaiz-test/oauth/token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: PAGE,
    client_id: APP,
    code_verifier: verifier,
  });
}

interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

async function signIn(member: string): Promise<Tokens> {
  const response = await redeem(await approve(member));
  expect(response.status).toBe(200);
  return (await response.json()) as Tokens;
}

function selectProjects(accessToken: string): Promise<Response> {
  return server.handle(
    new Request(`${ORIGIN}/__oaiz-test/storage/databases/${DB}/rows/select`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ table: "projects", select: "name" }),
    }),
  );
}

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

describe("test sign-in", () => {
  it("names the issuer and its endpoints on the request's origin", async () => {
    const response = await get("/__oaiz-test/oauth/.well-known/openid-configuration");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      userinfo_endpoint: `${ISSUER}/userinfo`,
      revocation_endpoint: `${ISSUER}/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
    });
  });

  it("shows one button per member of the members file, named by the member's name", async () => {
    const response = await get(`/__oaiz-test/oauth/authorize?${authorizeQuery()}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const page = await response.text();
    expect(page).toContain("<title>Sign in as a test member</title>");
    expect(page).toContain("<h1>Sign in as a test member</h1>");
    const buttons = [...page.matchAll(/<button [^>]*value="([^"]*)">([^<]*)<\/button>/g)].map(
      ([, value, name]) => [value, name],
    );
    expect(buttons).toEqual([
      [ADA, "Ada Lovelace"],
      [GRACE, "Grace &lt;Hopper&gt; &amp; co"],
    ]);
  });

  it("refuses a redirect URI on another origin, and a request without an S256 challenge", async () => {
    const refused: Record<string, string>[] = [
      { redirect_uri: "https://attacker.example/tasks" },
      { redirect_uri: "http://app.example.test:4382/tasks" },
      { redirect_uri: "not a url" },
      { code_challenge: "" },
      { code_challenge_method: "plain" },
    ];
    for (const overrides of refused) {
      const query = authorizeQuery(overrides);
      const page = await get(`/__oaiz-test/oauth/authorize?${query}`);
      expect(page.status, JSON.stringify(overrides)).toBe(400);
      expect(await errorOf(page)).toBe("invalid_request");

      const approval = await post("/__oaiz-test/oauth/authorize", {
        ...Object.fromEntries(new URLSearchParams(query)),
        member: ADA,
      });
      expect(approval.status, JSON.stringify(overrides)).toBe(400);
      expect(approval.headers.get("location")).toBeNull();
    }
  });

  it("refuses to approve a member the members file does not hold", async () => {
    const response = await post("/__oaiz-test/oauth/authorize", {
      ...Object.fromEntries(new URLSearchParams(authorizeQuery())),
      member: "7e570000-0000-4000-8000-0000000000ff",
    });

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe("invalid_request");
  });

  it("redeems a code once, with its verifier, client and redirect URI", async () => {
    const code = await approve(ADA);

    const wrongVerifier = await redeem(code, "w".repeat(43));
    expect(wrongVerifier.status).toBe(400);
    expect(await errorOf(wrongVerifier)).toBe("invalid_grant");
    const wrongClient = await post("/__oaiz-test/oauth/token", {
      grant_type: "authorization_code",
      code,
      redirect_uri: PAGE,
      client_id: "7e570000-0000-4000-8000-0000000000a2",
      code_verifier: VERIFIER,
    });
    expect(await errorOf(wrongClient)).toBe("invalid_grant");
    const wrongRedirect = await post("/__oaiz-test/oauth/token", {
      grant_type: "authorization_code",
      code,
      redirect_uri: `${ORIGIN}/other`,
      client_id: APP,
      code_verifier: VERIFIER,
    });
    expect(await errorOf(wrongRedirect)).toBe("invalid_grant");

    const redeemed = await redeem(code);
    expect(redeemed.status).toBe(200);
    expect(redeemed.headers.get("cache-control")).toBe("no-store");
    const tokens = (await redeemed.json()) as Tokens;
    expect(tokens).toEqual({
      access_token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      refresh_token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      token_type: "Bearer",
      expires_in: 3600,
      scope: "openid email profile",
    });

    const reused = await redeem(code);
    expect(reused.status).toBe(400);
    expect(await errorOf(reused)).toBe("invalid_grant");
  });

  it("rotates the refresh token, and the rotated-out one stops working", async () => {
    const first = await signIn(ADA);

    const renewed = await post("/__oaiz-test/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: first.refresh_token,
      client_id: APP,
    });
    expect(renewed.status).toBe(200);
    const second = (await renewed.json()) as Tokens;
    expect(second.refresh_token).not.toBe(first.refresh_token);
    expect(second.access_token).not.toBe(first.access_token);
    expect((await selectProjects(second.access_token)).status).toBe(200);

    const again = await post("/__oaiz-test/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: first.refresh_token,
      client_id: APP,
    });
    expect(again.status).toBe(400);
    expect(await errorOf(again)).toBe("invalid_grant");

    const otherClient = await post("/__oaiz-test/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: second.refresh_token,
      client_id: "7e570000-0000-4000-8000-0000000000a2",
    });
    expect(await errorOf(otherClient)).toBe("invalid_grant");
  });

  it("answers userinfo for the signed-in member, and Core's 401s without a known token", async () => {
    const { access_token } = await signIn(GRACE);

    const user = await get("/__oaiz-test/oauth/userinfo", { authorization: `Bearer ${access_token}` });
    expect(user.status).toBe(200);
    expect(await user.json()).toEqual({
      sub: GRACE,
      name: "Grace <Hopper> & co",
      email: "grace@example.test",
      email_verified: true,
    });

    const missing = await get("/__oaiz-test/oauth/userinfo");
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toBe("Bearer");
    const unknown = await get("/__oaiz-test/oauth/userinfo", { authorization: "Bearer nope" });
    expect(unknown.status).toBe(401);
    expect(((await unknown.json()) as { slug: string }).slug).toBe("invalid-token");
  });

  it("ends the session on revoke, so its access token no longer reads rows", async () => {
    const { access_token, refresh_token } = await signIn(ADA);
    expect((await selectProjects(access_token)).status).toBe(200);

    const revoked = await post("/__oaiz-test/oauth/revoke", {
      token: refresh_token,
      token_type_hint: "refresh_token",
      client_id: APP,
    });
    expect(revoked.status).toBe(200);

    const rows = await selectProjects(access_token);
    expect(rows.status).toBe(401);
    expect(((await rows.json()) as { slug: string }).slug).toBe("invalid-token");
    const renewed = await post("/__oaiz-test/oauth/token", {
      grant_type: "refresh_token",
      refresh_token,
      client_id: APP,
    });
    expect(await errorOf(renewed)).toBe("invalid_grant");
    const unknown = await post("/__oaiz-test/oauth/revoke", { token: "nope", client_id: APP });
    expect(unknown.status).toBe(200);
  });
});

class MemoryStorage {
  private readonly items = new Map<string, string>();
  get length(): number {
    return this.items.size;
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  clear(): void {
    this.items.clear();
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
}

describe("the SDK's own sign-in against the test issuer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("signs a member in, reads rows as them and signs out", async () => {
    const page = { href: PAGE, assign: vi.fn() };
    vi.stubGlobal("sessionStorage", new MemoryStorage());
    vi.stubGlobal("location", page);
    vi.stubGlobal("history", {
      state: null,
      replaceState: (_state: unknown, _unused: string, url: string) => {
        page.href = url;
      },
    });
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
      server.handle(new Request(input, init)),
    );
    const app = () =>
      createClient({ url: `${ORIGIN}/__oaiz-test`, app: APP, database: DB });

    expect((await app().auth.signIn()).error).toBeNull();
    const authorize = String(page.assign.mock.calls[0][0]);
    const signInPage = await (await get(authorize.slice(ORIGIN.length))).text();
    const form = /<form [^>]*>((?:<input [^>]*>)*)<button [^>]*value="([^"]*)">Ada Lovelace</.exec(
      signInPage,
    );
    expect(form).not.toBeNull();
    const fields = Object.fromEntries(
      [...(form?.[1] ?? "").matchAll(/name="([^"]*)" value="([^"]*)"/g)].map(([, name, value]) => [
        name,
        value.replaceAll("&amp;", "&"),
      ]),
    );
    const approval = await post("/__oaiz-test/oauth/authorize", { ...fields, member: form?.[2] ?? "" });
    expect(approval.status).toBe(303);
    page.href = approval.headers.get("location") ?? "";

    const client = app();
    const session = await client.auth.getSession();
    expect(session.error).toBeNull();
    expect(session.data?.scope).toBe("openid email profile");
    expect(page.href).toBe(PAGE);
    expect((await client.auth.getUser()).data).toEqual({
      id: ADA,
      name: "Ada Lovelace",
      email: "ada@example.test",
      emailVerified: true,
    });
    expect(await client.from("projects").select("name")).toMatchObject({
      data: [{ name: "Launch" }],
      error: null,
    });

    const accessToken = session.data?.accessToken ?? "";
    expect((await client.auth.signOut()).error).toBeNull();
    expect((await client.auth.getSession()).data).toBeNull();
    expect((await selectProjects(accessToken)).status).toBe(401);
  });
});
