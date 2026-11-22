import type { Client, RequestOptions, GetWorkflowRunParams } from "../client";
import { ApiError } from "../errors";
import * as models from "../models";

/**
 * Get a workflow run.
 *
 * Returns the run's current status, jobs and event references without waiting. An event is pending if it is not stored yet. A stored event is not pending, even if the caller cannot read its content. Set publishEvents to the value used to start the run, as for the follow route; it defaults to true. With false, the run does not wait for jobs its published events could start.
 */
export const getWorkflowRun = async function (
  this: Client,
  runUuid: string,
  params?: GetWorkflowRunParams,
  options?: RequestOptions,
): Promise<models.DtoWorkflowRun> {
  let path = `/ingest/runs/${wireEscape(String(runUuid))}`;
  const selectedAuth = this._selectAuthAlternative("getWorkflowRun", [
    [
      { schemeId: "BearerAuth", kind: "bearer" },
    ],
    [
      { schemeId: "ApiKeyAuth", kind: "apiKey", name: "authorization" },
    ],
  ]);
  const searchParams = new URLSearchParams();
  if (params?.publishEvents !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "publishEvents",
      params.publishEvents,
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
      operationId: "getWorkflowRun",
      pathTemplate: "/ingest/runs/{runUuid}",
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
    return await this._decodeJson<models.DtoWorkflowRun>(res);
  }
  throw new ApiError(res.status);
};
/**
 * Start a workflow run and stream its progress.
 *
 * Starts at jobUuid if provided, or at the only root listening for the input event type. Returns SSE progress with a run snapshot on the last terminal or waiting frame. The stream holds that frame until the events the run names are stored, for at most 10 seconds; after that, the snapshot marks those events pending. If the stream budget ends first, the stream ends without this snapshot. Use the frame ID to resume with the execution-log follow route.
 */
export const createWorkflowRunStream = async function (
  this: Client,
  workflowUuid: string,
  body: models.DtoWorkflowRunRequest,
  options?: RequestOptions,
): Promise<Blob> {
  let path = `/ingest/workflows/${wireEscape(String(workflowUuid))}/runs/stream`;
  const selectedAuth = this._selectAuthAlternative("createWorkflowRunStream", [
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
      operationId: "createWorkflowRunStream",
      pathTemplate: "/ingest/workflows/{workflowUuid}/runs/stream",
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
