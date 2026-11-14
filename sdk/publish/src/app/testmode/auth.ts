// The test mode's OpenID Connect issuer at `/__oaiz-test/oauth`: the shapes of the OAIZ server's OAuth
// provider that the SDK's sign-in in app/auth.ts reads, with a
// page that signs in any member of tests/members.json instead of an OAIZ account.

import { createHash, randomBytes } from "node:crypto";

import type { OaizTestMember } from "./members";

/** One member's sign-in to one app; its access tokens and its refresh token end together. */
export interface SignInSession {
  member: OaizTestMember;
  clientId: string;
  scope: string;
  accessTokens: Set<string>;
  refreshToken: string;
}

export interface TestAuth {
  /** Answers a request to the issuer route, the path after `/__oaiz-test/oauth/`; undefined for a route it does not serve. */
  handle(request: Request, route: string): Promise<Response | undefined>;
  /** Opens a session for memberId in the app clientId and returns its access token. */
  issueToken(memberId: string, clientId: string): string;
  /** The session of the request's Bearer access token, or the 401 the OAIZ server's app token gate answers. */
  authenticate(request: Request): SignInSession | Response;
}

/** An issued code: single use, and redeemed only by the client, redirect URI and verifier it was issued for. */
interface AuthorizationCode {
  member: OaizTestMember;
  clientId: string;
  redirectUri: string;
  challenge: string;
  scope: string;
}

interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  state: string | null;
  challenge: string;
  scope: string;
}

const accessTokenLifetimeSeconds = 3600;
const noStore = { "cache-control": "no-store" };
const pageTitle = "Sign in as a test member";

/** The issuer of the members `members` returns, read on every sign-in so a reset members file applies. */
export function createTestAuth(members: () => readonly OaizTestMember[]): TestAuth {
  const codes = new Map<string, AuthorizationCode>();
  const accessTokens = new Map<string, SignInSession>();
  const refreshTokens = new Map<string, SignInSession>();

  /** A session with no tokens yet; rotate gives it its first pair. */
  function newSession(member: OaizTestMember, clientId: string, scope: string): SignInSession {
    return { member, clientId, scope, accessTokens: new Set(), refreshToken: "" };
  }

  /** Gives the session a new access token and a new refresh token; the old refresh token stops working. */
  function rotate(session: SignInSession): string {
    refreshTokens.delete(session.refreshToken);
    const accessToken = randomToken();
    session.accessTokens.add(accessToken);
    accessTokens.set(accessToken, session);
    session.refreshToken = randomToken();
    refreshTokens.set(session.refreshToken, session);
    return accessToken;
  }

  function end(session: SignInSession): void {
    for (const token of session.accessTokens) accessTokens.delete(token);
    session.accessTokens.clear();
    refreshTokens.delete(session.refreshToken);
  }

  function tokenAnswer(session: SignInSession, accessToken: string): Response {
    return json(200, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: accessTokenLifetimeSeconds,
      refresh_token: session.refreshToken,
      scope: session.scope,
    }, noStore);
  }

  function discovery(request: Request): Response {
    const issuer = `${new URL(request.url).origin}/__oaiz-test/oauth`;
    return json(200, {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/userinfo`,
      revocation_endpoint: `${issuer}/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
    });
  }

  function authorizePage(request: Request): Response {
    const parameters = new URL(request.url).searchParams;
    const read = readAuthorizationRequest(parameters, new URL(request.url).origin);
    if (read instanceof Response) return read;
    const hidden = [
      ["response_type", "code"],
      ["client_id", read.clientId],
      ["redirect_uri", read.redirectUri],
      ["scope", read.scope],
      ["code_challenge", read.challenge],
      ["code_challenge_method", "S256"],
      ...(read.state === null ? [] : [["state", read.state]]),
    ]
      .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHTML(value)}">`)
      .join("");
    const seeded = members();
    const forms =
      seeded.length === 0
        ? "<p>No members can sign in. Add them to tests/members.json.</p>"
        : seeded
            .map(
              (member) =>
                `<form method="post" action="/__oaiz-test/oauth/authorize">${hidden}<button type="submit" name="member" value="${escapeHTML(member.id)}">${escapeHTML(member.name)}</button></form>`,
            )
            .join("\n");
    const body = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${pageTitle}</title></head>
<body><main><h1>${pageTitle}</h1>
${forms}
</main></body>
</html>
`;
    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", ...noStore },
    });
  }

  async function approve(request: Request): Promise<Response> {
    const form = new URLSearchParams(await request.text());
    const read = readAuthorizationRequest(form, new URL(request.url).origin);
    if (read instanceof Response) return read;
    const member = members().find((candidate) => candidate.id === form.get("member"));
    if (member === undefined) return oauthError(400, "invalid_request", "member is not in tests/members.json");
    const code = randomToken();
    codes.set(code, {
      member,
      clientId: read.clientId,
      redirectUri: read.redirectUri,
      challenge: read.challenge,
      scope: read.scope,
    });
    const target = new URL(read.redirectUri);
    target.searchParams.set("code", code);
    if (read.state !== null) target.searchParams.set("state", read.state);
    target.searchParams.set("iss", `${new URL(request.url).origin}/__oaiz-test/oauth`);
    return new Response(null, { status: 303, headers: { location: target.toString() } });
  }

  async function token(request: Request): Promise<Response> {
    const form = new URLSearchParams(await request.text());
    const clientId = form.get("client_id") ?? "";
    switch (form.get("grant_type")) {
      case "authorization_code": {
        const code = form.get("code") ?? "";
        const grant = codes.get(code);
        if (
          grant === undefined ||
          grant.clientId !== clientId ||
          grant.redirectUri !== form.get("redirect_uri") ||
          s256(form.get("code_verifier") ?? "") !== grant.challenge
        ) {
          return oauthError(400, "invalid_grant", "the code is unknown, used, or not this request's");
        }
        codes.delete(code);
        const session = newSession(grant.member, grant.clientId, grant.scope);
        return tokenAnswer(session, rotate(session));
      }
      case "refresh_token": {
        const session = refreshTokens.get(form.get("refresh_token") ?? "");
        if (session === undefined || session.clientId !== clientId) {
          return oauthError(400, "invalid_grant", "the refresh token is unknown, rotated, or revoked");
        }
        return tokenAnswer(session, rotate(session));
      }
      default:
        return oauthError(400, "unsupported_grant_type", "grant_type must be authorization_code or refresh_token");
    }
  }

  function authenticate(request: Request): SignInSession | Response {
    const presented = bearerToken(request.headers.get("authorization"));
    if (presented === undefined) {
      return json(
        401,
        { message: "Authorization header not provided", slug: "no-authorization-header" },
        { "www-authenticate": "Bearer" },
      );
    }
    const session = accessTokens.get(presented);
    if (session === undefined) {
      return json(
        401,
        { message: "authentication: Invalid token", slug: "invalid-token" },
        { "www-authenticate": 'Bearer error="invalid_token"' },
      );
    }
    return session;
  }

  function userinfo(request: Request): Response {
    const session = authenticate(request);
    if (session instanceof Response) return session;
    const { member } = session;
    return json(200, {
      sub: member.id,
      name: member.name,
      email: member.email,
      email_verified: true,
    });
  }

  /** RFC 7009: ends the session of a refresh or access token of the client; any other token answers 200 too. */
  async function revoke(request: Request): Promise<Response> {
    const form = new URLSearchParams(await request.text());
    const presented = form.get("token") ?? "";
    if (presented === "") return oauthError(400, "invalid_request", "token is required");
    const session = refreshTokens.get(presented) ?? accessTokens.get(presented);
    if (session !== undefined && session.clientId === form.get("client_id")) end(session);
    return new Response(null, { status: 200, headers: noStore });
  }

  return {
    async handle(request, route) {
      const method = request.method;
      if (route === ".well-known/openid-configuration" && method === "GET") return discovery(request);
      if (route === "authorize" && method === "GET") return authorizePage(request);
      if (route === "authorize" && method === "POST") return approve(request);
      if (route === "token" && method === "POST") return token(request);
      if (route === "userinfo" && (method === "GET" || method === "POST")) return userinfo(request);
      if (route === "revoke" && method === "POST") return revoke(request);
      return undefined;
    },
    issueToken(memberId, clientId) {
      const member = members().find((candidate) => candidate.id === memberId);
      if (member === undefined) throw new Error(`tests/members.json has no member ${memberId}`);
      return rotate(newSession(member, clientId, "openid email profile"));
    },
    authenticate,
  };
}

/**
 * The authorization request an app sends, or the 400 that refuses it: a code response, a client,
 * a redirect URI on the page's own origin, and an S256 challenge.
 */
function readAuthorizationRequest(
  parameters: URLSearchParams,
  origin: string,
): AuthorizationRequest | Response {
  if (parameters.get("response_type") !== "code") {
    return oauthError(400, "invalid_request", "response_type must be code");
  }
  const clientId = parameters.get("client_id") ?? "";
  if (clientId === "") return oauthError(400, "invalid_request", "client_id is required");
  const redirectUri = parameters.get("redirect_uri") ?? "";
  if (!URL.canParse(redirectUri) || new URL(redirectUri).origin !== origin) {
    return oauthError(400, "invalid_request", `redirect_uri must be a page on ${origin}`);
  }
  const challenge = parameters.get("code_challenge") ?? "";
  if (challenge === "" || parameters.get("code_challenge_method") !== "S256") {
    return oauthError(400, "invalid_request", "an S256 code_challenge is required");
  }
  return {
    clientId,
    redirectUri,
    state: parameters.get("state"),
    challenge,
    scope: parameters.get("scope") ?? "openid",
  };
}

/** The token of a Bearer Authorization header; the scheme is case-insensitive. */
function bearerToken(header: string | null): string | undefined {
  const separator = header?.indexOf(" ") ?? -1;
  if (header === null || separator < 0) return undefined;
  const token = header.slice(separator + 1);
  return header.slice(0, separator).toLowerCase() === "bearer" && token !== "" ? token : undefined;
}

function s256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** An RFC 6749 error body; protocol answers are never cached, as the OAIZ server's are not. */
function oauthError(status: number, error: string, description: string): Response {
  return json(status, { error, error_description: description }, noStore);
}

function json(status: number, body: object, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
