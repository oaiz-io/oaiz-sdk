import type {
  Client,
  RequestOptions,
  ListToolsParams,
  GetNativeToolsParams,
} from "../client";
import { ApiError } from "../errors";
import * as models from "../models";

/**
 * List tools.
 *
 * List the caller's selectable native and granted integration tools for agent
 * or code jobs. Agent is the default. Ready items include partial selection
 * JSON to merge into an existing action.config; unavailable integrations and
 * actions have diagnostics instead. Filters match tool descriptions and names,
 * integration providers and instance names, and action labels.
 */
export const listTools = async function (
  this: Client,
  params?: ListToolsParams,
  options?: RequestOptions,
): Promise<models.DtoWorkflowToolList> {
  let path = `/ingest/tools`;
  const selectedAuth = this._selectAuthAlternative("listTools", [
    [
      { schemeId: "BearerAuth", kind: "bearer" },
    ],
    [
      { schemeId: "ApiKeyAuth", kind: "apiKey", name: "authorization" },
    ],
  ]);
  const searchParams = new URLSearchParams();
  if (params?.integrationUuid !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "integrationUuid",
      params.integrationUuid,
      "form",
      true,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  if (params?.job !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "job",
      params.job,
      "form",
      true,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  if (params?.nativeOnly !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "nativeOnly",
      params.nativeOnly,
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
      operationId: "listTools",
      pathTemplate: "/ingest/tools",
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
    return await this._decodeJson<models.DtoWorkflowToolList>(res);
  }
  throw new ApiError(res.status);
};
/**
 * Get Native Tools.
 *
 * Get list of available native tools with their metadata and descriptions. Returns tools based on configured API keys. A request through an app asking for the app surface gets the native tools on that surface. A tool that uses no OAIZ resource is included when the app's native tool list names it, and a resource tool stays subject to the app's resource access.
 */
export const getNativeTools = async function (
  this: Client,
  params?: GetNativeToolsParams,
  options?: RequestOptions,
): Promise<models.DtoGetNativeToolsOutput> {
  let path = `/ingest/tools/native`;
  const selectedAuth = this._selectAuthAlternative("getNativeTools", [
    [
      { schemeId: "BearerAuth", kind: "bearer" },
    ],
    [
      { schemeId: "ApiKeyAuth", kind: "apiKey", name: "authorization" },
    ],
  ]);
  const searchParams = new URLSearchParams();
  if (params?.surface !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "surface",
      params.surface,
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
      operationId: "getNativeTools",
      pathTemplate: "/ingest/tools/native",
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
    return await this._decodeJson<models.DtoGetNativeToolsOutput>(res);
  }
  throw new ApiError(res.status);
};
/**
 * Run a tool.
 *
 * Run one tool as the caller, by the selector from list: an exact native name
 * or integrationUuid:actionType. Native tools come from the code job tool set,
 * or from the app chat tool set for an app access token, and read the
 * caller's own access. Integration tools run only when they are
 * ready in the caller's catalog, and the caller's grants admit them. A false
 * executeIntegrationCommand or executeIntegrationQuery returns the provider's
 * mock output for that action category; both flags are required. Knowledge
 * tools and storage_execute write only when executeIntegrationCommand is true.
 * event_create publishes for real.
 */
export const runTool = async function (
  this: Client,
  selector: string,
  body: models.DtoToolRunRequest,
  options?: RequestOptions,
): Promise<models.DtoToolRunResult> {
  let path = `/ingest/tools/${wireEscape(String(selector))}/run`;
  const selectedAuth = this._selectAuthAlternative("runTool", [
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
      operationId: "runTool",
      pathTemplate: "/ingest/tools/{selector}/run",
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
    return await this._decodeJson<models.DtoToolRunResult>(res);
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
