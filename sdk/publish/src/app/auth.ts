import type { OaizError } from "./response";

/** A member's session with an app. */
export interface OaizSession {
  /** The app access token every request of the client sends as its Bearer credential. */
  accessToken: string;
  /** When the access token expires, in milliseconds since the Unix epoch. */
  expiresAt: number;
  /** The scope the member approved, space separated. */
  scope: string;
}

/** The member a session signs in, as OAIZ releases them to the app. */
export interface OaizUser {
  /** The member's identifier (`sub`). */
  id: string;
  /** The member's email address. */
  email?: string;
  /** Whether OAIZ has confirmed that the member owns `email`. */
  emailVerified?: boolean;
  /** The member's full name. */
  name?: string;
}

/** Every auth method resolves to this or to `{ error }`; none throws. */
export type OaizAuthResponse<T> =
  | { data: T; error: null }
  | { data: null; error: OaizError };

/** Signs a member in to the app with OAIZ from the browser, keeps the session fresh and signs out. */
export interface OaizAuth {
  /** Sends the browser to OAIZ to approve the sign-in; the page loads again at the same address, signed in. */
  signIn(): Promise<{ error: OaizError | null }>;
  /**
   * The current session, renewed first when its access token expires within a minute; `data` is null
   * when no member is signed in. `error` reports a sign-in this page came back from that failed; a
   * session from before it stays in use for requests.
   */
  getSession(): Promise<OaizAuthResponse<OaizSession | null>>;
  /** The signed-in member. */
  getUser(): Promise<OaizAuthResponse<OaizUser>>;
  /** Ends the session at OAIZ and forgets it in this browser, whatever OAIZ answers. */
  signOut(): Promise<{ error: OaizError | null }>;
}

/** How long before its expiry an access token is renewed. */
const RENEW_BEFORE_EXPIRY_MS = 60_000;
const SCOPE = "openid email profile";
/** The parameters OAIZ adds to the page address when it sends the browser back. */
const RESPONSE_PARAMETERS = ["code", "state", "iss", "error", "error_description"];

const NO_BROWSER: OaizError = {
  message: "Signing in needs a browser page.",
  code: "auth-browser-required",
  hints: [],
};
const SIGNED_OUT: OaizError = {
  message: "No member is signed in to the app.",
  code: "auth-signed-out",
  hints: [],
};
const STATE_MISMATCH: OaizError = {
  message: "The sign-in answer does not belong to the sign-in this page started.",
  code: "auth-state-mismatch",
  hints: [],
};
const ISSUER_MISMATCH: OaizError = {
  message: "The sign-in answer does not come from the OAIZ this page signed in with.",
  code: "auth-issuer-mismatch",
  hints: [],
};

interface StoredSession extends OaizSession {
  refreshToken: string;
}

/** The sign-in this page started and has not completed. */
interface PendingSignIn {
  state: string;
  verifier: string;
  redirectUri: string;
  issuer: string;
}

interface SessionRead {
  session: StoredSession | undefined;
  error: OaizError | null;
}

/** A token endpoint answer: new tokens, or an error and whether OAIZ refused the request. */
type TokenAnswer =
  | { tokens: StoredSession; error?: undefined; refused?: undefined }
  | { tokens?: undefined; error: OaizError; refused: boolean };

interface BrowserScope {
  location: Location;
  sessionStorage: Storage;
  history: History;
}

function browser(): BrowserScope | undefined {
  const scope = globalThis as Partial<BrowserScope>;
  if (scope.location === undefined || scope.sessionStorage === undefined || scope.history === undefined) {
    return undefined;
  }
  return { location: scope.location, sessionStorage: scope.sessionStorage, history: scope.history };
}

/**
 * The session of one app in this browser tab, kept in sessionStorage under `oaiz.auth.<app>`: it
 * survives reloads and ends when the tab closes. The app
 * signs in as a public client: a PKCE verifier proves the sign-in, and no request carries a client
 * secret.
 */
export class AppAuth implements OaizAuth {
  private readonly issuer: string;
  private readonly sessionKey: string;
  private readonly signInKey: string;
  /** Completes a sign-in the page came back from; settles with its error, or null. */
  private readonly redirect: Promise<OaizError | null>;
  private renewing: Promise<SessionRead> | undefined;
  private readonly signOutHooks = new Set<() => Promise<void>>();

  constructor(
    url: string,
    private readonly app: string,
  ) {
    this.issuer = `${url.replace(/\/+$/, "")}/oauth`;
    this.sessionKey = `oaiz.auth.${app}`;
    this.signInKey = `oaiz.auth.${app}.signIn`;
    this.redirect = this.completeSignIn();
  }

  async signIn(): Promise<{ error: OaizError | null }> {
    const scope = browser();
    if (scope === undefined) {
      return { error: NO_BROWSER };
    }
    try {
      const response = await fetch(`${this.issuer}/.well-known/openid-configuration`, {
        headers: { Accept: "application/json" },
      });
      const discovery = await readJSON(response);
      if (
        !response.ok ||
        !isRecord(discovery) ||
        typeof discovery.issuer !== "string" ||
        typeof discovery.authorization_endpoint !== "string"
      ) {
        return { error: answerError(response.status, discovery) };
      }
      const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
      const page = new URL(scope.location.href);
      page.hash = "";
      // OAIZ appends its answer to the redirect URI, so the page's own parameters
      // with those names would be read as the answer.
      for (const name of RESPONSE_PARAMETERS) {
        page.searchParams.delete(name);
      }
      const pending: PendingSignIn = {
        state: base64url(crypto.getRandomValues(new Uint8Array(16))),
        verifier,
        redirectUri: page.toString(),
        issuer: discovery.issuer,
      };
      scope.sessionStorage.setItem(this.signInKey, JSON.stringify(pending));
      const target = new URL(discovery.authorization_endpoint);
      target.searchParams.set("response_type", "code");
      target.searchParams.set("client_id", this.app);
      target.searchParams.set("redirect_uri", pending.redirectUri);
      target.searchParams.set("scope", SCOPE);
      target.searchParams.set("state", pending.state);
      target.searchParams.set("code_challenge", base64url(new Uint8Array(digest)));
      target.searchParams.set("code_challenge_method", "S256");
      scope.location.assign(target.toString());
      return { error: null };
    } catch (cause) {
      return { error: transportError(cause) };
    }
  }

  async getSession(): Promise<OaizAuthResponse<OaizSession | null>> {
    const read = await this.session();
    if (read.error !== null) {
      return { data: null, error: read.error };
    }
    if (read.session === undefined) {
      return { data: null, error: null };
    }
    const { accessToken, expiresAt, scope } = read.session;
    return { data: { accessToken, expiresAt, scope }, error: null };
  }

  async getUser(): Promise<OaizAuthResponse<OaizUser>> {
    const read = await this.session();
    if (read.session === undefined) {
      return { data: null, error: read.error ?? SIGNED_OUT };
    }
    try {
      const response = await fetch(`${this.issuer}/userinfo`, {
        headers: { Authorization: `Bearer ${read.session.accessToken}` },
      });
      const claims = await readJSON(response);
      if (!response.ok || !isRecord(claims) || typeof claims.sub !== "string") {
        return { data: null, error: answerError(response.status, claims) };
      }
      const user: OaizUser = { id: claims.sub };
      if (typeof claims.email === "string") {
        user.email = claims.email;
      }
      if (typeof claims.email_verified === "boolean") {
        user.emailVerified = claims.email_verified;
      }
      if (typeof claims.name === "string") {
        user.name = claims.name;
      }
      return { data: user, error: null };
    } catch (cause) {
      return { data: null, error: transportError(cause) };
    }
  }

  async signOut(): Promise<{ error: OaizError | null }> {
    await this.redirect;
    await Promise.all([...this.signOutHooks].map((hook) => hook()));
    await this.renewing;
    const stored = this.readSession();
    this.clearSession();
    if (stored === undefined) {
      return { error: null };
    }
    try {
      const response = await fetch(
        `${this.issuer}/revoke`,
        formRequest({ token: stored.refreshToken, token_type_hint: "refresh_token", client_id: this.app }),
      );
      if (response.status === 200) {
        return { error: null };
      }
      return { error: answerError(response.status, await readJSON(response)) };
    } catch (cause) {
      return { error: transportError(cause) };
    }
  }

  /** The access token a request sends; undefined when no member is signed in. */
  async accessToken(): Promise<string | undefined> {
    return (await this.session()).session?.accessToken;
  }

  /** The stored access token, read with no network call, for a request page leave can end. */
  storedAccessToken(): string | undefined {
    return this.readSession()?.accessToken;
  }

  /** Runs `hook` before a sign-out forgets the session, and answers the function that removes it. `hook` must not reject. */
  beforeSignOut(hook: () => Promise<void>): () => void {
    this.signOutHooks.add(hook);
    return () => {
      this.signOutHooks.delete(hook);
    };
  }

  /**
   * The stored session, renewed first when its access token expires within a minute. One renewal
   * runs at a time per client, and every caller waits for it. A sign-in this page came back from
   * that failed is reported with it, so a session kept from before does not hide the failure.
   */
  private async session(): Promise<SessionRead> {
    const redirectError = await this.redirect;
    const stored = this.readSession();
    if (stored === undefined) {
      return { session: undefined, error: redirectError };
    }
    if (stored.expiresAt - Date.now() > RENEW_BEFORE_EXPIRY_MS) {
      return { session: stored, error: redirectError };
    }
    if (this.renewing === undefined) {
      this.renewing = this.renew(stored).finally(() => {
        this.renewing = undefined;
      });
    }
    const read = await this.renewing;
    return redirectError === null ? read : { session: read.session, error: redirectError };
  }

  /**
   * Rotates the session's refresh token. A refusal ends the session in this browser; when no
   * answer arrives the current access token is sent until a renewal succeeds.
   */
  private async renew(stored: StoredSession): Promise<SessionRead> {
    const answer = await this.requestTokens({
      grant_type: "refresh_token",
      refresh_token: stored.refreshToken,
      client_id: this.app,
    });
    if (answer.tokens !== undefined) {
      this.writeSession(answer.tokens);
      return { session: answer.tokens, error: null };
    }
    if (answer.refused) {
      this.clearSession();
      return { session: undefined, error: answer.error };
    }
    return { session: stored, error: null };
  }

  /**
   * Redeems the code OAIZ sent the browser back with. The pending sign-in is removed before any
   * request, so a second client on the page never redeems the code again, and the response
   * parameters leave the page address.
   */
  private async completeSignIn(): Promise<OaizError | null> {
    const scope = browser();
    if (scope === undefined) {
      return null;
    }
    try {
      const page = new URL(scope.location.href);
      const parameters = new URLSearchParams(page.search);
      const state = parameters.get("state");
      const code = parameters.get("code");
      const error = parameters.get("error");
      if (state === null || (code === null && error === null)) {
        return null;
      }
      const raw = scope.sessionStorage.getItem(this.signInKey);
      if (raw === null) {
        return null;
      }
      scope.sessionStorage.removeItem(this.signInKey);
      for (const name of RESPONSE_PARAMETERS) {
        page.searchParams.delete(name);
      }
      scope.history.replaceState(scope.history.state, "", page.toString());
      const pending = parsePendingSignIn(raw);
      if (pending === undefined || pending.state !== state) {
        return STATE_MISMATCH;
      }
      if (parameters.get("iss") !== pending.issuer) {
        return ISSUER_MISMATCH;
      }
      if (error !== null) {
        return { message: parameters.get("error_description") ?? error, code: error, hints: [] };
      }
      const answer = await this.requestTokens({
        grant_type: "authorization_code",
        code: code ?? "",
        redirect_uri: pending.redirectUri,
        client_id: this.app,
        code_verifier: pending.verifier,
      });
      if (answer.tokens === undefined) {
        return answer.error;
      }
      this.writeSession(answer.tokens);
      return null;
    } catch (cause) {
      return transportError(cause);
    }
  }

  private async requestTokens(form: Record<string, string>): Promise<TokenAnswer> {
    let response: Response;
    try {
      response = await fetch(`${this.issuer}/token`, formRequest(form));
    } catch (cause) {
      return { error: transportError(cause), refused: false };
    }
    const body = await readJSON(response);
    const tokens = response.ok ? parseTokens(body) : undefined;
    if (tokens !== undefined) {
      return { tokens };
    }
    const refused =
      (response.status === 400 || response.status === 401) && isRecord(body) && typeof body.error === "string";
    return { error: answerError(response.status, body), refused };
  }

  private readSession(): StoredSession | undefined {
    const raw = browser()?.sessionStorage.getItem(this.sessionKey);
    return raw === null || raw === undefined ? undefined : parseSession(raw);
  }

  private writeSession(session: StoredSession): void {
    browser()?.sessionStorage.setItem(this.sessionKey, JSON.stringify(session));
  }

  private clearSession(): void {
    browser()?.sessionStorage.removeItem(this.sessionKey);
  }
}

/** A form POST without an Authorization header, a CORS simple request. */
function formRequest(form: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  };
}

async function readJSON(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** The session a token answer carries, or undefined when it carries none. */
function parseTokens(body: unknown): StoredSession | undefined {
  if (
    !isRecord(body) ||
    typeof body.access_token !== "string" ||
    typeof body.refresh_token !== "string" ||
    typeof body.expires_in !== "number"
  ) {
    return undefined;
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    scope: typeof body.scope === "string" ? body.scope : "",
  };
}

function parseSession(raw: string): StoredSession | undefined {
  const value = parseStored(raw);
  if (
    !isRecord(value) ||
    typeof value.accessToken !== "string" ||
    typeof value.refreshToken !== "string" ||
    typeof value.expiresAt !== "number" ||
    typeof value.scope !== "string"
  ) {
    return undefined;
  }
  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    expiresAt: value.expiresAt,
    scope: value.scope,
  };
}

function parsePendingSignIn(raw: string): PendingSignIn | undefined {
  const value = parseStored(raw);
  if (
    !isRecord(value) ||
    typeof value.state !== "string" ||
    typeof value.verifier !== "string" ||
    typeof value.redirectUri !== "string" ||
    typeof value.issuer !== "string"
  ) {
    return undefined;
  }
  return {
    state: value.state,
    verifier: value.verifier,
    redirectUri: value.redirectUri,
    issuer: value.issuer,
  };
}

function parseStored(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** An OAIZ answer that is not a success: an OAuth error body names the code, and anything else the status. */
function answerError(status: number, body: unknown): OaizError {
  if (isRecord(body) && typeof body.error === "string") {
    const description = typeof body.error_description === "string" ? body.error_description : body.error;
    return { message: description, code: body.error, hints: [] };
  }
  return { message: `OAIZ answered ${status}.`, code: "", hints: [] };
}

/** No answer arrived; the code is empty, as for a query the builder could not send. */
function transportError(cause: unknown): OaizError {
  return { message: cause instanceof Error ? cause.message : String(cause), code: "", hints: [] };
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
