import type {
  Client,
  RequestOptions,
  FollowOaizChatThreadParams,
  ListOaizChatMessagesParams,
} from "../client";
import { ApiError } from "../errors";
import * as models from "../models";

/**
 * Follow committed messages in an OAIZ Chat thread (SSE).
 *
 * Requires View on the connection. Streams committed messages oldest first,
 * beginning after the supplied cursor or at the beginning of the thread.
 * Message frames carry a cursor as their SSE ID. State frames report working,
 * idle or ended. An ended thread can receive a new message and continue.
 */
export const followOaizChatThread = async function (
  this: Client,
  connectionId: string,
  threadId: string,
  params?: FollowOaizChatThreadParams,
  options?: RequestOptions,
): Promise<Blob> {
  let path = `/ingest/oaiz-chat/${wireEscape(String(connectionId))}/threads/${wireEscape(String(threadId))}/events`;
  const selectedAuth = this._selectAuthAlternative("followOaizChatThread", [
    [
      { schemeId: "BearerAuth", kind: "bearer" },
    ],
    [
      { schemeId: "ApiKeyAuth", kind: "apiKey", name: "authorization" },
    ],
  ]);
  const searchParams = new URLSearchParams();
  if (params?.after !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "after",
      params.after,
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
      operationId: "followOaizChatThread",
      pathTemplate: "/ingest/oaiz-chat/{connectionId}/threads/{threadId}/events",
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
 * List committed messages in an OAIZ Chat thread.
 *
 * Requires View on the connection. The first page returns the newest messages
 * and latestCursor for following new messages. Use nextCursor to page backward.
 */
export const listOaizChatMessages = async function (
  this: Client,
  connectionId: string,
  threadId: string,
  params?: ListOaizChatMessagesParams,
  options?: RequestOptions,
): Promise<models.DtoOaizChatMessagePage> {
  let path = `/ingest/oaiz-chat/${wireEscape(String(connectionId))}/threads/${wireEscape(String(threadId))}/messages`;
  const selectedAuth = this._selectAuthAlternative("listOaizChatMessages", [
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
      operationId: "listOaizChatMessages",
      pathTemplate: "/ingest/oaiz-chat/{connectionId}/threads/{threadId}/messages",
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
    return await this._decodeJson<models.DtoOaizChatMessagePage>(res);
  }
  throw new ApiError(res.status);
};
export const listOaizChatMessagesPages = async function* (
  this: Client,
  connectionId: string,
  threadId: string,
  params?: ListOaizChatMessagesParams,
  options?: RequestOptions,
): AsyncIterable<models.DtoOaizChatMessagePage> {
  const pageParams: ListOaizChatMessagesParams = { ...params };
  while (true) {
    const page = await this.listOaizChatMessages(connectionId, threadId, pageParams, options);
    yield page;
    const nextCursor = page.nextCursor;
    if (nextCursor === undefined || nextCursor === null || nextCursor === "") {
      break;
    }
    pageParams.cursor = nextCursor;
  }
};
export const iterateListOaizChatMessages = async function* (
  this: Client,
  connectionId: string,
  threadId: string,
  params?: ListOaizChatMessagesParams,
  options?: RequestOptions,
): AsyncIterable<models.DtoOaizChatMessage> {
  for await (const page of this.listOaizChatMessagesPages(connectionId, threadId, params, options)) {
    for (const item of page.items ?? []) {
      yield item;
    }
  }
};
/**
 * Send an OAIZ Chat message.
 *
 * Accepts a message for a thread on an OAIZ Chat connection. Requires Edit on
 * the connection. Resending the same clientMessageId on that thread returns
 * the same receipt.
 */
export const sendOaizChatMessage = async function (
  this: Client,
  connectionId: string,
  threadId: string,
  body: models.DtoOaizChatSendMessageRequest,
  options?: RequestOptions,
): Promise<models.DtoOaizChatSendMessageReceipt> {
  let path = `/ingest/oaiz-chat/${wireEscape(String(connectionId))}/threads/${wireEscape(String(threadId))}/messages`;
  const selectedAuth = this._selectAuthAlternative("sendOaizChatMessage", [
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
      operationId: "sendOaizChatMessage",
      pathTemplate: "/ingest/oaiz-chat/{connectionId}/threads/{threadId}/messages",
      idempotent: false,
      idempotencyKeyHeader: "Idempotency-Key",
      successStatuses: [202],
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
  if (res.status === 202) {
    return await this._decodeJson<models.DtoOaizChatSendMessageReceipt>(res);
  }
  throw new ApiError(res.status);
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
