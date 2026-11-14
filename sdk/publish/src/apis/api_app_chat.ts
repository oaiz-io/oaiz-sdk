import type {
  Client,
  RequestOptions,
  ListAppChatSessionsParams,
} from "../client";
import { ApiError } from "../errors";
import * as models from "../models";

/**
 * Send an app chat message (SSE).
 *
 * Sends one member message to the app's chat and streams the turn as
 * Server-Sent Events: each chat_event frame carries one chat timeline event,
 * starting with session.created for a new chat and generation.started, and
 * ending with generation.finished. The turn uses only the tools the message
 * names and runs each at once, except a tool with requireApproval: the turn
 * saves that call without running it and ends with
 * tool.approvalRequired, whose toolCallId the decision route names, then
 * generation.finished. systemPrompt is the whole system prompt and is not
 * stored. A message the turn would refuse, an unknown field, a session of
 * another member or app, a session whose tool call waits for a decision (409)
 * and a credential other than this app's access token are answered with an
 * error status before any frame. Closing the stream stops the turn; the parts
 * it already saved stay in the session. The server writes a ping comment frame
 * every 15 seconds while idle. A message of type voice_delegation runs the same
 * turn, and its stream then carries one voice.delegationResult frame after
 * generation.finished, unless it was closed.
 */
export const createAppChatMessage = async function (
  this: Client,
  appUuid: string,
  body: models.DtoAppChatMessageRequest,
  options?: RequestOptions,
): Promise<Blob> {
  let path = `/internalagents/chat/apps/${wireEscape(String(appUuid))}/messages`;
  const selectedAuth = this._selectAuthAlternative("createAppChatMessage", [
    [
      { schemeId: "BearerAuth", kind: "bearer" },
    ],
    [
      { schemeId: "ApiKeyAuth", kind: "apiKey", name: "authorization" },
    ],
  ]);
  const headers: Record<string, string> = {};
  if (selectedAuth.has("ApiKeyAuth")) {
    const apiKey0 = this._apiKey("ApiKeyAuth", "authorization");
    if (apiKey0 !== undefined) {
      headers["authorization"] = apiKey0;
    }
  }
  if (selectedAuth.has("BearerAuth")) {
    const bearerAuth = this._bearerAuth();
    if (bearerAuth !== undefined) {
      headers["Authorization"] = bearerAuth;
    }
  }
  headers["Content-Type"] = "application/json";
  const requestBody = JSON.stringify(body);
  const res = await this._request(
    "POST",
    path,
    headers,
    requestBody,
    {
      operationId: "createAppChatMessage",
      pathTemplate: "/internalagents/chat/apps/{appUuid}/messages",
      idempotent: false,
      idempotencyKeyHeader: "Idempotency-Key",
      successStatuses: [200],
    },
    options,
  );
  if (res.status < 200 || res.status >= 300) {
    const { rawBody, jsonBody } = await this._readErrorBody(res);
    let errorBody: unknown = jsonBody;
    if (res.status === 400) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 401) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 402) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 403) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 404) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 409) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 413) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 429) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 500) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 503) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    throw new ApiError(res.status, {
      headers: res.headers,
      requestId: res.headers.get("x-request-id") ?? undefined,
      rawBody,
      jsonBody,
      body: errorBody,
    });
  }
  if (res.status === 200) {
    return await res.blob();
  }
  throw new ApiError(res.status);
};
/**
 * List app chat sessions.
 *
 * List the signed-in member's chats in this app, newest first, with
 * cursor-based pagination with cursor and pageSize. A chat with no message is
 * left out. Only this app's access token is admitted, and it lists no other
 * app's chats and no OAIZ chats.
 */
export const listAppChatSessions = async function (
  this: Client,
  appUuid: string,
  params?: ListAppChatSessionsParams,
  options?: RequestOptions,
): Promise<models.DtoChatSessionListOutput> {
  let path = `/internalagents/chat/apps/${wireEscape(String(appUuid))}/sessions`;
  const selectedAuth = this._selectAuthAlternative("listAppChatSessions", [
    [
      { schemeId: "BearerAuth", kind: "bearer" },
    ],
    [
      { schemeId: "ApiKeyAuth", kind: "apiKey", name: "authorization" },
    ],
  ]);
  const searchParams = new URLSearchParams();
  if (params?.cursor !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "cursor",
      params.cursor,
      "form",
      true,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  if (params?.pageSize !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "pageSize",
      params.pageSize,
      "form",
      true,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  const qs = wireQueryString(searchParams);
  if (qs) {
    path = path + "?" + qs;
  }
  const headers: Record<string, string> = {};
  if (selectedAuth.has("ApiKeyAuth")) {
    const apiKey0 = this._apiKey("ApiKeyAuth", "authorization");
    if (apiKey0 !== undefined) {
      headers["authorization"] = apiKey0;
    }
  }
  if (selectedAuth.has("BearerAuth")) {
    const bearerAuth = this._bearerAuth();
    if (bearerAuth !== undefined) {
      headers["Authorization"] = bearerAuth;
    }
  }
  const res = await this._request(
    "GET",
    path,
    headers,
    undefined,
    {
      operationId: "listAppChatSessions",
      pathTemplate: "/internalagents/chat/apps/{appUuid}/sessions",
      idempotent: false,
      idempotencyKeyHeader: "Idempotency-Key",
      successStatuses: [200],
    },
    options,
  );
  if (res.status < 200 || res.status >= 300) {
    const { rawBody, jsonBody } = await this._readErrorBody(res);
    let errorBody: unknown = jsonBody;
    if (res.status === 400) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 401) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 402) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 403) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 404) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 409) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 413) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 429) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 500) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 503) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    throw new ApiError(res.status, {
      headers: res.headers,
      requestId: res.headers.get("x-request-id") ?? undefined,
      rawBody,
      jsonBody,
      body: errorBody,
    });
  }
  if (res.status === 200) {
    return await this._decodeJson<models.DtoChatSessionListOutput>(res);
  }
  throw new ApiError(res.status);
};
/**
 * Get an app chat session.
 *
 * Get one of the signed-in member's chats in this app with all its messages
 * and, while one of its tool calls waits for the member's decision,
 * pendingApproval naming that call. Only this app's access token is admitted;
 * another member's chat, another app's chat and an OAIZ chat are not found.
 */
export const getAppChatSession = async function (
  this: Client,
  appUuid: string,
  sessionId: string,
  options?: RequestOptions,
): Promise<models.DtoAppChatSessionDetail> {
  let path = `/internalagents/chat/apps/${wireEscape(String(appUuid))}/sessions/${wireEscape(String(sessionId))}`;
  const selectedAuth = this._selectAuthAlternative("getAppChatSession", [
    [
      { schemeId: "BearerAuth", kind: "bearer" },
    ],
    [
      { schemeId: "ApiKeyAuth", kind: "apiKey", name: "authorization" },
    ],
  ]);
  const headers: Record<string, string> = {};
  if (selectedAuth.has("ApiKeyAuth")) {
    const apiKey0 = this._apiKey("ApiKeyAuth", "authorization");
    if (apiKey0 !== undefined) {
      headers["authorization"] = apiKey0;
    }
  }
  if (selectedAuth.has("BearerAuth")) {
    const bearerAuth = this._bearerAuth();
    if (bearerAuth !== undefined) {
      headers["Authorization"] = bearerAuth;
    }
  }
  const res = await this._request(
    "GET",
    path,
    headers,
    undefined,
    {
      operationId: "getAppChatSession",
      pathTemplate: "/internalagents/chat/apps/{appUuid}/sessions/{sessionId}",
      idempotent: false,
      idempotencyKeyHeader: "Idempotency-Key",
      successStatuses: [200],
    },
    options,
  );
  if (res.status < 200 || res.status >= 300) {
    const { rawBody, jsonBody } = await this._readErrorBody(res);
    let errorBody: unknown = jsonBody;
    if (res.status === 400) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 401) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 402) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 403) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 404) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 409) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 413) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 429) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 500) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 503) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    throw new ApiError(res.status, {
      headers: res.headers,
      requestId: res.headers.get("x-request-id") ?? undefined,
      rawBody,
      jsonBody,
      body: errorBody,
    });
  }
  if (res.status === 200) {
    return await this._decodeJson<models.DtoAppChatSessionDetail>(res);
  }
  throw new ApiError(res.status);
};
/**
 * Approve or decline an app chat tool call (SSE).
 *
 * Records the member's decision on the tool call a paused app chat turn waits
 * on and streams the continued turn as Server-Sent Events, like a message:
 * generation.started, then the call's result (it runs when approved; when
 * declined the model is told the member declined it), the rest of the answer
 * and generation.finished. The turn may pause again on a further
 * requireApproval call. The body resends the turn settings the message sent,
 * which are not stored. A call that is not waiting for a decision, including
 * one already decided, is answered with 409 app-chat-tool-call-not-pending
 * before any frame; a request the turn would refuse, an unknown field, a
 * session of another member or app and a credential other than this app's
 * access token are answered with an error status before any frame. The
 * decision is recorded once, on whichever server receives it.
 */
export const createAppChatApproval = async function (
  this: Client,
  appUuid: string,
  sessionId: string,
  toolCallId: string,
  body: models.DtoAppChatApprovalRequest,
  options?: RequestOptions,
): Promise<Blob> {
  let path = `/internalagents/chat/apps/${wireEscape(String(appUuid))}/sessions/${wireEscape(String(sessionId))}/approvals/${wireEscape(String(toolCallId))}`;
  const selectedAuth = this._selectAuthAlternative("createAppChatApproval", [
    [
      { schemeId: "BearerAuth", kind: "bearer" },
    ],
    [
      { schemeId: "ApiKeyAuth", kind: "apiKey", name: "authorization" },
    ],
  ]);
  const headers: Record<string, string> = {};
  if (selectedAuth.has("ApiKeyAuth")) {
    const apiKey0 = this._apiKey("ApiKeyAuth", "authorization");
    if (apiKey0 !== undefined) {
      headers["authorization"] = apiKey0;
    }
  }
  if (selectedAuth.has("BearerAuth")) {
    const bearerAuth = this._bearerAuth();
    if (bearerAuth !== undefined) {
      headers["Authorization"] = bearerAuth;
    }
  }
  headers["Content-Type"] = "application/json";
  const requestBody = JSON.stringify(body);
  const res = await this._request(
    "POST",
    path,
    headers,
    requestBody,
    {
      operationId: "createAppChatApproval",
      pathTemplate: "/internalagents/chat/apps/{appUuid}/sessions/{sessionId}/approvals/{toolCallId}",
      idempotent: false,
      idempotencyKeyHeader: "Idempotency-Key",
      successStatuses: [200],
    },
    options,
  );
  if (res.status < 200 || res.status >= 300) {
    const { rawBody, jsonBody } = await this._readErrorBody(res);
    let errorBody: unknown = jsonBody;
    if (res.status === 400) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 401) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 402) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 403) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 404) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 409) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 413) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 429) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 500) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 503) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    throw new ApiError(res.status, {
      headers: res.headers,
      requestId: res.headers.get("x-request-id") ?? undefined,
      rawBody,
      jsonBody,
      body: errorBody,
    });
  }
  if (res.status === 200) {
    return await res.blob();
  }
  throw new ApiError(res.status);
};
/**
 * Record an app voice line.
 *
 * Store one spoken line of the voice session running on this chat, so that the
 * chat's later turns read it. A line is not shown as a chat message and runs no
 * turn. A chat with no running voice session refuses the line with a conflict.
 * Only this app's access token is admitted; another member's chat, another
 * app's chat and an OAIZ chat are not found.
 */
export const createAppVoiceLine = async function (
  this: Client,
  appUuid: string,
  sessionId: string,
  body: models.DtoAppVoiceLineInput,
  options?: RequestOptions,
): Promise<void> {
  let path = `/internalagents/chat/apps/${wireEscape(String(appUuid))}/sessions/${wireEscape(String(sessionId))}/voice-lines`;
  const selectedAuth = this._selectAuthAlternative("createAppVoiceLine", [
    [
      { schemeId: "BearerAuth", kind: "bearer" },
    ],
    [
      { schemeId: "ApiKeyAuth", kind: "apiKey", name: "authorization" },
    ],
  ]);
  const headers: Record<string, string> = {};
  if (selectedAuth.has("ApiKeyAuth")) {
    const apiKey0 = this._apiKey("ApiKeyAuth", "authorization");
    if (apiKey0 !== undefined) {
      headers["authorization"] = apiKey0;
    }
  }
  if (selectedAuth.has("BearerAuth")) {
    const bearerAuth = this._bearerAuth();
    if (bearerAuth !== undefined) {
      headers["Authorization"] = bearerAuth;
    }
  }
  headers["Content-Type"] = "application/json";
  const requestBody = JSON.stringify(body);
  const res = await this._request(
    "POST",
    path,
    headers,
    requestBody,
    {
      operationId: "createAppVoiceLine",
      pathTemplate: "/internalagents/chat/apps/{appUuid}/sessions/{sessionId}/voice-lines",
      idempotent: false,
      idempotencyKeyHeader: "Idempotency-Key",
      successStatuses: [204],
    },
    options,
  );
  if (res.status < 200 || res.status >= 300) {
    const { rawBody, jsonBody } = await this._readErrorBody(res);
    let errorBody: unknown = jsonBody;
    if (res.status === 400) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 401) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 402) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 403) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 404) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 409) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 413) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 429) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 500) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 503) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    throw new ApiError(res.status, {
      headers: res.headers,
      requestId: res.headers.get("x-request-id") ?? undefined,
      rawBody,
      jsonBody,
      body: errorBody,
    });
  }
};
/**
 * Open an app live voice session.
 *
 * Exchange a browser WebRTC offer for a provider answer and start a metered
 * full-duplex voice session on one of the signed-in member's chats in this app;
 * a new chat starts without sessionId, and the answer names it. instructions
 * tells the voice about the app. The voice model has no tools: each thing the
 * member asks for runs as a message of type voice_delegation. Only this app's
 * access token is admitted; another member's chat, another app's chat and an
 * OAIZ chat are not found.
 */
export const createAppLiveVoiceSession = async function (
  this: Client,
  appUuid: string,
  body: models.DtoAppLiveVoiceSessionInput,
  options?: RequestOptions,
): Promise<models.DtoAppLiveVoiceSessionOutput> {
  let path = `/internalagents/chat/apps/${wireEscape(String(appUuid))}/voice/sessions`;
  const selectedAuth = this._selectAuthAlternative("createAppLiveVoiceSession", [
    [
      { schemeId: "BearerAuth", kind: "bearer" },
    ],
    [
      { schemeId: "ApiKeyAuth", kind: "apiKey", name: "authorization" },
    ],
  ]);
  const headers: Record<string, string> = {};
  if (selectedAuth.has("ApiKeyAuth")) {
    const apiKey0 = this._apiKey("ApiKeyAuth", "authorization");
    if (apiKey0 !== undefined) {
      headers["authorization"] = apiKey0;
    }
  }
  if (selectedAuth.has("BearerAuth")) {
    const bearerAuth = this._bearerAuth();
    if (bearerAuth !== undefined) {
      headers["Authorization"] = bearerAuth;
    }
  }
  headers["Content-Type"] = "application/json";
  const requestBody = JSON.stringify(body);
  const res = await this._request(
    "POST",
    path,
    headers,
    requestBody,
    {
      operationId: "createAppLiveVoiceSession",
      pathTemplate: "/internalagents/chat/apps/{appUuid}/voice/sessions",
      idempotent: false,
      idempotencyKeyHeader: "Idempotency-Key",
      successStatuses: [201],
    },
    options,
  );
  if (res.status < 200 || res.status >= 300) {
    const { rawBody, jsonBody } = await this._readErrorBody(res);
    let errorBody: unknown = jsonBody;
    if (res.status === 400) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 401) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 402) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 403) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 404) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 409) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 413) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 429) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 500) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 503) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    throw new ApiError(res.status, {
      headers: res.headers,
      requestId: res.headers.get("x-request-id") ?? undefined,
      rawBody,
      jsonBody,
      body: errorBody,
    });
  }
  if (res.status === 201) {
    return await this._decodeJson<models.DtoAppLiveVoiceSessionOutput>(res);
  }
  throw new ApiError(res.status);
};
/**
 * Release an app live voice session.
 *
 * End a voice session of the signed-in member on a chat in this app and emit
 * its cost. Releasing a session Core has already finalized is a no-op. Another
 * member's session and a session outside this app's chats are not found.
 */
export const deleteAppLiveVoiceSession = async function (
  this: Client,
  appUuid: string,
  id: string,
  options?: RequestOptions,
): Promise<void> {
  let path = `/internalagents/chat/apps/${wireEscape(String(appUuid))}/voice/sessions/${wireEscape(String(id))}`;
  const selectedAuth = this._selectAuthAlternative("deleteAppLiveVoiceSession", [
    [
      { schemeId: "BearerAuth", kind: "bearer" },
    ],
    [
      { schemeId: "ApiKeyAuth", kind: "apiKey", name: "authorization" },
    ],
  ]);
  const headers: Record<string, string> = {};
  if (selectedAuth.has("ApiKeyAuth")) {
    const apiKey0 = this._apiKey("ApiKeyAuth", "authorization");
    if (apiKey0 !== undefined) {
      headers["authorization"] = apiKey0;
    }
  }
  if (selectedAuth.has("BearerAuth")) {
    const bearerAuth = this._bearerAuth();
    if (bearerAuth !== undefined) {
      headers["Authorization"] = bearerAuth;
    }
  }
  const res = await this._request(
    "DELETE",
    path,
    headers,
    undefined,
    {
      operationId: "deleteAppLiveVoiceSession",
      pathTemplate: "/internalagents/chat/apps/{appUuid}/voice/sessions/{id}",
      idempotent: false,
      idempotencyKeyHeader: "Idempotency-Key",
      successStatuses: [204],
    },
    options,
  );
  if (res.status < 200 || res.status >= 300) {
    const { rawBody, jsonBody } = await this._readErrorBody(res);
    let errorBody: unknown = jsonBody;
    if (res.status === 400) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 401) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 402) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 403) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 404) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 409) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 413) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 429) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 500) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    if (res.status === 503) {
      errorBody = jsonBody as models.DtoHttpError;
    }
    throw new ApiError(res.status, {
      headers: res.headers,
      requestId: res.headers.get("x-request-id") ?? undefined,
      rawBody,
      jsonBody,
      body: errorBody,
    });
  }
};

function wireParameterPairs(
  name: string,
  value: unknown,
  style: string,
  explode: boolean,
): Array<[string, string]> {
  const delimiter =
    style === "spaceDelimited" ? " " : style === "pipeDelimited" ? "|" : ",";
  if (Array.isArray(value)) {
    const parts = value.map((item) => String(item));
    return explode && style === "form"
      ? parts.map((item) => [name, item])
      : [[name, parts.join(delimiter)]];
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    if (style === "deepObject") {
      return entries.map(([key, item]) => [
        name + "[" + key + "]",
        String(item),
      ]);
    }
    if (explode && style === "form") {
      return entries.map(([key, item]) => [key, String(item)]);
    }
    const parts = entries.flatMap(([key, item]) =>
      explode ? [key + "=" + String(item)] : [key, String(item)],
    );
    return [[name, parts.join(delimiter)]];
  }
  return [[name, String(value)]];
}

function wireQueryString(
  values: URLSearchParams,
  allowReserved: Set<number> = new Set<number>(),
): string {
  const restoreReserved = (value: string): string =>
    value.replace(
      /%3A|%2F|%3F|%23|%5B|%5D|%40|%21|%24|%26|%27|%28|%29|%2A|%2B|%2C|%3B|%3D/gi,
      (token) => decodeURIComponent(token),
    );
  const parts: string[] = [];
  let index = 0;
  values.forEach((value, key) => {
    const encoded = wireEscape(value);
    parts.push(
      wireEscape(key) +
        "=" +
        (allowReserved.has(index) ? restoreReserved(encoded) : encoded),
    );
    index += 1;
  });
  return parts.join("&");
}

function wireEscape(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase(),
  );
}
