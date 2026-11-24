import type { Client, RequestOptions, ListAppUsersParams } from "../client";
import { ApiError } from "../errors";
import * as models from "../models";

/**
 * List the people who can use an app.
 *
 * Returns the user IDs and display names of verified people with access through
 * a direct, Team or organisation grant or their Administrator role. An app
 * session can read its own app, and a first-party caller needs access to the
 * named app. A missing or inaccessible app returns 404 `app-not-found`.
 * Search matches display names case-insensitively. `userId` limits results to
 * that person if they are in the audience. Pages are ordered by descending user
 * ID. Pass the opaque `nextCursor` to continue with the same filters.
 */
export const listAppUsers = async function (
  this: Client,
  appUuid: string,
  params?: ListAppUsersParams,
  options?: RequestOptions,
): Promise<models.DtoAppUserPage> {
  let path = `/user/apps/${wireEscape(String(appUuid))}/users`;
  const selectedAuth = this._selectAuthAlternative("listAppUsers", [
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
  if (params?.query !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "query",
      params.query,
      "form",
      true,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  if (params?.userId !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "userId",
      params.userId,
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
      operationId: "listAppUsers",
      pathTemplate: "/user/apps/{appUuid}/users",
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
    return await this._decodeJson<models.DtoAppUserPage>(res);
  }
  throw new ApiError(res.status);
};
export const listAppUsersPages = async function* (
  this: Client,
  appUuid: string,
  params?: ListAppUsersParams,
  options?: RequestOptions,
): AsyncIterable<models.DtoAppUserPage> {
  const pageParams: ListAppUsersParams = { ...params };
  while (true) {
    const page = await this.listAppUsers(appUuid, pageParams, options);
    yield page;
    const nextCursor = page.nextCursor;
    if (nextCursor === undefined || nextCursor === null || nextCursor === "") {
      break;
    }
    pageParams.cursor = nextCursor;
  }
};
export const iterateListAppUsers = async function* (
  this: Client,
  appUuid: string,
  params?: ListAppUsersParams,
  options?: RequestOptions,
): AsyncIterable<models.DtoAppUser> {
  for await (const page of this.listAppUsersPages(appUuid, params, options)) {
    for (const item of page.items ?? []) {
      yield item;
    }
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
