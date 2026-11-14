import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "../../index";

const API = "https://api.oaiz.test";
const ISSUER = `${API}/oauth`;
const AUTHORIZE = "https://app.oaiz.test/oauth/authorize";
const APP = "7e570000-0000-4000-8000-000000000001";
const DATABASE = "db-1";
const PAGE = "https://app.example.test/notes?tab=open";
const SESSION_KEY = `oaiz.auth.${APP}`;
const SIGN_IN_KEY = `oaiz.auth.${APP}.signIn`;
const TOOL_REQUEST = {
  arguments: { databaseUuid: DATABASE, sql: "SELECT * FROM notes" },
  executeIntegrationCommand: false,
  executeIntegrationQuery: true,
};

type Answer = { status: number; body?: unknown };

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

let storage: MemoryStorage;
let page: { href: string; assign: ReturnType<typeof vi.fn> };
let replaceState: ReturnType<typeof vi.fn>;
let tokenAnswers: Answer[];
let userinfoAnswer: Answer;
let revokeAnswer: Answer;
let fetchMock: ReturnType<typeof vi.fn>;

function respond(answer: Answer): Response {
  const body = answer.body === undefined ? "" : JSON.stringify(answer.body);
  return new Response(body, { status: answer.status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  storage = new MemoryStorage();
  page = { href: PAGE, assign: vi.fn() };
  replaceState = vi.fn((_state: unknown, _unused: string, url: string) => {
    page.href = url;
  });
  tokenAnswers = [];
  userinfoAnswer = { status: 200, body: { sub: "member-1" } };
  revokeAnswer = { status: 200 };
  fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    if (url === `${ISSUER}/.well-known/openid-configuration`) {
      return respond({ status: 200, body: { issuer: ISSUER, authorization_endpoint: AUTHORIZE } });
    }
    if (url === `${ISSUER}/token`) {
      return respond(tokenAnswers.shift() ?? { status: 500 });
    }
    if (url === `${ISSUER}/userinfo`) {
      return respond(userinfoAnswer);
    }
    if (url === `${ISSUER}/revoke`) {
      return respond(revokeAnswer);
    }
    if (url.startsWith(`${API}/storage/databases/`)) {
      return respond({ status: 200, body: { rows: [] } });
    }
    if (url === `${API}/ingest/tools/storage_query/run`) {
      return respond({ status: 200, body: { selector: "storage_query", kind: "native", result: { rows: [] } } });
    }
    throw new Error(`unexpected request ${init?.method ?? "GET"} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("location", page);
  vi.stubGlobal("history", { state: null, replaceState });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function app() {
  return createClient({ url: API, app: APP, database: DATABASE });
}

function tokens(access: string, refresh: string, expiresIn = 300): Answer {
  return {
    status: 200,
    body: { access_token: access, refresh_token: refresh, expires_in: expiresIn, token_type: "Bearer", scope: "openid email" },
  };
}

function storeSession(expiresAt: number, access = "access-1", refresh = "refresh-1"): void {
  storage.setItem(
    SESSION_KEY,
    JSON.stringify({ accessToken: access, refreshToken: refresh, expiresAt, scope: "openid email" }),
  );
}

function storePendingSignIn(state = "state-1"): void {
  storage.setItem(
    SIGN_IN_KEY,
    JSON.stringify({ state, verifier: "v".repeat(43), redirectUri: PAGE, issuer: ISSUER }),
  );
}

function returnTo(parameters: Record<string, string>): void {
  const url = new URL(PAGE);
  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, value);
  }
  page.href = url.toString();
}

/** The requests sent to path, with their headers and form body. */
function sentTo(path: string): { headers: Record<string, string>; form: URLSearchParams | undefined }[] {
  return fetchMock.mock.calls
    .filter(([url]) => String(url) === `${ISSUER}${path}`)
    .map(([, init]) => {
      const request = (init ?? {}) as RequestInit;
      return {
        headers: (request.headers ?? {}) as Record<string, string>,
        form: typeof request.body === "string" ? new URLSearchParams(request.body) : undefined,
      };
    });
}

describe("signIn", () => {
  it("sends the browser to the authorization endpoint with an S256 challenge of the stored verifier", async () => {
    const { error } = await app().auth.signIn();
    expect(error).toBeNull();
    expect(page.assign).toHaveBeenCalledTimes(1);
    const target = new URL(page.assign.mock.calls[0]?.[0] as string);
    expect(`${target.origin}${target.pathname}`).toBe(AUTHORIZE);
    const pending = JSON.parse(storage.getItem(SIGN_IN_KEY) ?? "{}");
    expect(pending.verifier).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
    const challenge = createHash("sha256").update(pending.verifier).digest("base64url");
    expect(Object.fromEntries(target.searchParams)).toEqual({
      response_type: "code",
      client_id: APP,
      redirect_uri: PAGE,
      scope: "openid email profile",
      state: pending.state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    expect(pending).toMatchObject({ redirectUri: PAGE, issuer: ISSUER });
  });

  it("leaves the page's own OAuth response parameters out of the redirect URI", async () => {
    page.href = `${PAGE}&code=invite-1&state=old&iss=x&error=e&error_description=d`;
    await app().auth.signIn();
    const target = new URL(page.assign.mock.calls[0]?.[0] as string);
    expect(target.searchParams.get("redirect_uri")).toBe(PAGE);
  });

  it("refuses without a browser", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", fetchMock);
    const client = app();
    const { error } = await client.auth.signIn();
    expect(error?.code).toBe("auth-browser-required");
    expect(await client.auth.getSession()).toEqual({ data: null, error: null });
  });
});

describe("the redirect back from OAIZ", () => {
  it("is exchanged once with the verifier and no client secret, and the address is cleaned", async () => {
    storePendingSignIn();
    returnTo({ code: "code-1", state: "state-1", iss: ISSUER });
    tokenAnswers.push(tokens("access-1", "refresh-1"));
    const first = app();
    const second = app();
    const session = await first.auth.getSession();
    await second.auth.getSession();
    expect(session.data?.accessToken).toBe("access-1");
    const exchanges = sentTo("/token");
    expect(exchanges).toHaveLength(1);
    expect(exchanges[0]?.headers).not.toHaveProperty("Authorization");
    expect(Object.fromEntries(exchanges[0]?.form ?? [])).toEqual({
      grant_type: "authorization_code",
      code: "code-1",
      redirect_uri: PAGE,
      client_id: APP,
      code_verifier: "v".repeat(43),
    });
    expect(storage.getItem(SIGN_IN_KEY)).toBeNull();
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(page.href).toBe(PAGE);
    expect((await first.tools.run("storage_query", TOOL_REQUEST)).error).toBeNull();
    const tool = fetchMock.mock.calls.find(([url]) => String(url) === `${API}/ingest/tools/storage_query/run`);
    expect((tool?.[1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer access-1" });
  });

  it("keeps the session in the tab's sessionStorage and writes nothing to localStorage", async () => {
    const persistent = new MemoryStorage();
    vi.stubGlobal("localStorage", persistent);
    storePendingSignIn();
    returnTo({ code: "code-1", state: "state-1", iss: ISSUER });
    tokenAnswers.push(tokens("access-1", "refresh-1"));
    const session = await app().auth.getSession();
    expect(session.data?.accessToken).toBe("access-1");
    expect(storage.getItem(SESSION_KEY)).not.toBeNull();
    expect(persistent.length).toBe(0);
  });

  it.each<{ name: string; parameters: Record<string, string>; code: string }>([
    { name: "a state the page did not start", parameters: { code: "code-1", state: "other", iss: ISSUER }, code: "auth-state-mismatch" },
    { name: "another issuer", parameters: { code: "code-1", state: "state-1", iss: "https://evil.test/oauth" }, code: "auth-issuer-mismatch" },
    { name: "no issuer", parameters: { code: "code-1", state: "state-1" }, code: "auth-issuer-mismatch" },
  ])("refuses $name without a token request", async ({ parameters, code }) => {
    storePendingSignIn();
    returnTo(parameters);
    const session = await app().auth.getSession();
    expect(session.error?.code).toBe(code);
    expect(sentTo("/token")).toHaveLength(0);
    expect(storage.getItem(SIGN_IN_KEY)).toBeNull();
  });

  it("reports a refused sign-in", async () => {
    storePendingSignIn();
    returnTo({ error: "access_denied", error_description: "the member did not authorize the app", state: "state-1", iss: ISSUER });
    const session = await app().auth.getSession();
    expect(session.error).toEqual({ message: "the member did not authorize the app", code: "access_denied", hints: [] });
    expect(sentTo("/token")).toHaveLength(0);
  });

  it("reports a failed sign-in even when a session from before remains, which requests keep using", async () => {
    storeSession(Date.now() + 300_000);
    storePendingSignIn();
    returnTo({ error: "access_denied", state: "state-1", iss: ISSUER });
    const client = app();
    const session = await client.auth.getSession();
    expect(session).toEqual({ data: null, error: { message: "access_denied", code: "access_denied", hints: [] } });
    await client.from("deals").select();
    const rows = fetchMock.mock.calls.filter(([url]) => String(url).startsWith(`${API}/storage/`));
    expect((rows[0]?.[1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer access-1" });
  });

  it("leaves a page without a pending sign-in alone", async () => {
    returnTo({ code: "code-1", state: "state-1", iss: ISSUER });
    expect(await app().auth.getSession()).toEqual({ data: null, error: null });
    expect(sentTo("/token")).toHaveLength(0);
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe("requests", () => {
  it("send the access token, and none when signed out", async () => {
    storeSession(Date.now() + 300_000);
    await app().from("deals").select();
    storage.removeItem(SESSION_KEY);
    await app().from("deals").select();
    const rows = fetchMock.mock.calls.filter(([url]) => String(url).startsWith(`${API}/storage/`));
    expect(rows).toHaveLength(2);
    expect((rows[0]?.[1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer access-1" });
    expect((rows[1]?.[1] as RequestInit).headers).not.toHaveProperty("Authorization");
  });

  it("uses the same app session for tools on the client and a derived database client", async () => {
    storeSession(Date.now() + 300_000);
    const client = app();
    const other = client.database("db-2");
    expect(other.auth).toBe(client.auth);
    await client.tools.run("storage_query", TOOL_REQUEST);
    await other.tools.run("storage_query", TOOL_REQUEST);
    await client.auth.signOut();
    await other.tools.run("storage_query", TOOL_REQUEST);

    const tools = fetchMock.mock.calls.filter(([url]) => String(url) === `${API}/ingest/tools/storage_query/run`);
    expect(tools).toHaveLength(3);
    for (const [, init] of tools.slice(0, 2)) {
      expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer access-1" });
      expect(JSON.parse((init as RequestInit).body as string)).toEqual(TOOL_REQUEST);
    }
    expect((tools[2]?.[1] as RequestInit).headers).not.toHaveProperty("Authorization");
    expect(sentTo("/token")).toHaveLength(0);
  });
});

describe("renewal", () => {
  it("does not renew a token that expires in more than a minute", async () => {
    storeSession(Date.now() + 120_000);
    const session = await app().auth.getSession();
    expect(session.data?.accessToken).toBe("access-1");
    expect(sentTo("/token")).toHaveLength(0);
  });

  it("renews once for concurrent callers within a minute of expiry and stores the rotated pair", async () => {
    storeSession(Date.now() + 30_000);
    tokenAnswers.push(tokens("access-2", "refresh-2"));
    const client = app();
    const [a, b] = await Promise.all([
      client.auth.getSession(),
      client.auth.getSession(),
      client.from("deals").select(),
      client.tools.run("storage_query", TOOL_REQUEST),
      client.database("db-2").tools.run("storage_query", TOOL_REQUEST),
    ]);
    expect(a.data?.accessToken).toBe("access-2");
    expect(b.data?.accessToken).toBe("access-2");
    const renewals = sentTo("/token");
    expect(renewals).toHaveLength(1);
    expect(Object.fromEntries(renewals[0]?.form ?? [])).toEqual({
      grant_type: "refresh_token",
      refresh_token: "refresh-1",
      client_id: APP,
    });
    expect(JSON.parse(storage.getItem(SESSION_KEY) ?? "{}")).toMatchObject({ accessToken: "access-2", refreshToken: "refresh-2" });
    const tools = fetchMock.mock.calls.filter(([url]) => String(url) === `${API}/ingest/tools/storage_query/run`);
    expect(tools).toHaveLength(2);
    for (const [, init] of tools) {
      expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer access-2" });
    }
  });

  it("ends the session when OAIZ refuses the refresh token", async () => {
    storeSession(Date.now() + 30_000);
    tokenAnswers.push({ status: 400, body: { error: "invalid_grant", error_description: "the refresh token is not valid" } });
    const session = await app().auth.getSession();
    expect(session.error?.code).toBe("invalid_grant");
    expect(storage.getItem(SESSION_KEY)).toBeNull();
  });

  it("keeps the session when no answer arrives", async () => {
    storeSession(Date.now() + 30_000);
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("network down");
    });
    const session = await app().auth.getSession();
    expect(session.data?.accessToken).toBe("access-1");
    expect(storage.getItem(SESSION_KEY)).not.toBeNull();
  });
});

describe("getUser", () => {
  it("maps the released claims", async () => {
    storeSession(Date.now() + 300_000);
    userinfoAnswer = { status: 200, body: { sub: "member-1", email: "ada@example.com", email_verified: true, name: "Ada" } };
    const user = await app().auth.getUser();
    expect(user).toEqual({ data: { id: "member-1", email: "ada@example.com", emailVerified: true, name: "Ada" }, error: null });
    expect(sentTo("/userinfo")[0]?.headers).toEqual({ Authorization: "Bearer access-1" });
  });

  it("answers signed out without a session", async () => {
    const user = await app().auth.getUser();
    expect(user.error?.code).toBe("auth-signed-out");
    expect(sentTo("/userinfo")).toHaveLength(0);
  });
});

describe("signOut", () => {
  it("revokes the refresh token and forgets the session", async () => {
    storeSession(Date.now() + 300_000);
    const { error } = await app().auth.signOut();
    expect(error).toBeNull();
    const revocations = sentTo("/revoke");
    expect(revocations).toHaveLength(1);
    expect(revocations[0]?.headers).not.toHaveProperty("Authorization");
    expect(Object.fromEntries(revocations[0]?.form ?? [])).toEqual({
      token: "refresh-1",
      token_type_hint: "refresh_token",
      client_id: APP,
    });
    expect(storage.getItem(SESSION_KEY)).toBeNull();
  });

  it("forgets the session and reports a refusal", async () => {
    storeSession(Date.now() + 300_000);
    revokeAnswer = { status: 401, body: { error: "invalid_client" } };
    const { error } = await app().auth.signOut();
    expect(error?.code).toBe("invalid_client");
    expect(storage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe("createClient", () => {
  it("needs exactly one of key and app", () => {
    expect(() => createClient({ url: API, database: DATABASE } as never)).toThrow(TypeError);
    expect(() => createClient({ url: API, database: DATABASE, key: "k", app: APP } as never)).toThrow(TypeError);
  });
});
