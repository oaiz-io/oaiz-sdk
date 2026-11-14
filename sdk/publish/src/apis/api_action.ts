import type {
  Client,
  RequestOptions,
  ListActionExecutionLogsParams,
  StreamActionExecutionEventsParams,
} from "../client";
import { ApiError } from "../errors";
import * as models from "../models";

/**
 * List action execution logs.
 *
 * List job executions with optional filtering by job, workflow, status, and date range, one cursor page at a time.
 */
export const listActionExecutionLogs = async function (
  this: Client,
  params?: ListActionExecutionLogsParams,
  options?: RequestOptions,
): Promise<models.QueryListActionExecutionLogsOutput> {
  let path = `/ingest/action/log`;
  const selectedAuth = this._selectAuthAlternative("listActionExecutionLogs", [
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
  if (params?.endTime !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "endTime",
      params.endTime,
      "form",
      true,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  if (params?.excludeTestRuns !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "excludeTestRuns",
      params.excludeTestRuns,
      "form",
      true,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  if (params?.includeRunSummaries !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "includeRunSummaries",
      params.includeRunSummaries,
      "form",
      true,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  if (params?.jobUuid !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "jobUuid",
      params.jobUuid,
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
  if (params?.startTime !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "startTime",
      params.startTime,
      "form",
      true,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  if (params?.statuses !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "statuses",
      params.statuses,
      "form",
      false,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  if (params?.testRunUuid !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "testRunUuid",
      params.testRunUuid,
      "form",
      true,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  if (params?.triggeringEventUuid !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "triggeringEventUuid",
      params.triggeringEventUuid,
      "form",
      true,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  if (params?.updatedAfter !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "updatedAfter",
      params.updatedAfter,
      "form",
      true,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  if (params?.workflowUuid !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "workflowUuid",
      params.workflowUuid,
      "form",
      true,
    )) {
      searchParams.append(wireName, wireValue);
    }
  }
  if (params?.workflowVersionId !== undefined) {
    for (const [wireName, wireValue] of wireParameterPairs(
      "workflowVersionId",
      params.workflowVersionId,
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
      operationId: "listActionExecutionLogs",
      pathTemplate: "/ingest/action/log",
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
    return await this._decodeJson<models.QueryListActionExecutionLogsOutput>(res);
  }
  throw new ApiError(res.status);
};
export const listActionExecutionLogsPages = async function* (
  this: Client,
  params?: ListActionExecutionLogsParams,
  options?: RequestOptions,
): AsyncIterable<models.QueryListActionExecutionLogsOutput> {
  const pageParams: ListActionExecutionLogsParams = { ...params };
  while (true) {
    const page = await this.listActionExecutionLogs(pageParams, options);
    yield page;
    const nextCursor = page.nextCursor;
    if (nextCursor === undefined || nextCursor === null || nextCursor === "") {
      break;
    }
    pageParams.cursor = nextCursor;
  }
};
export const iterateListActionExecutionLogs = async function* (
  this: Client,
  params?: ListActionExecutionLogsParams,
  options?: RequestOptions,
): AsyncIterable<models.DtoActionExecutionLogMetadata> {
  for await (const page of this.listActionExecutionLogsPages(params, options)) {
    for (const item of page.items ?? []) {
      yield item;
    }
  }
};
/**
 * Get an action execution log.
 *
 * Get an action execution log by its UUID
 */
export const getActionExecutionLogByUuid = async function (
  this: Client,
  uuid: string,
  options?: RequestOptions,
): Promise<models.DtoActionExecutionLog> {
  let path = `/ingest/action/log/${wireEscape(String(uuid))}`;
  const selectedAuth = this._selectAuthAlternative("getActionExecutionLogByUUID", [
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
      operationId: "getActionExecutionLogByUUID",
      pathTemplate: "/ingest/action/log/{uuid}",
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
    return await this._decodeJson<models.DtoActionExecutionLog>(res);
  }
  throw new ApiError(res.status);
};
/**
 * Follow an action execution's trace (SSE).
 *
 * Streams the workflow trace that an action execution starts as Server-Sent Events, read from the execution logs while the trace runs and after it ends. The frames are the execute_progress frames of POST /ingest/jobs/{jobUuid}/execute/stream: root_start, then an execution_snapshot frame whenever an execution of the trace changes and an action_log frame for each of its log rows, then one terminal frame, or a waiting frame when the trace waits for an approval or a delay. An execution that failed before it ran ends with its error log and a failure terminal frame. The jobs the trace can still start come from the workflow version the execution ran. The client that started the run states publishEvents as it sent it to the start: with true, the default, the stream waits for the jobs the run's published events can start; with false, it waits for none. A publishEvents value that is not a boolean is 400 invalid-input. An execution of a test run is followed with publishEvents false. Every frame has an SSE id: a reader that sends it back as the Last-Event-ID header or the after query parameter reads the frames after that frame, with no gap and no repeat. An invalid cursor is 400 invalid-input. A resumed stream keeps the publishEvents of its cursor; a publishEvents query value that differs from it is 400 invalid-input. The stream ends after its terminal or waiting frame. A terminal frame with a slug reports a failed read, not the end of the trace: a reader that resumes after it follows the trace again. The server writes a ping comment frame every 15 seconds while idle so intermediary proxies keep the connection open.
 */
export const streamActionExecutionEvents = async function (
  this: Client,
  uuid: string,
  params?: StreamActionExecutionEventsParams,
  options?: RequestOptions,
): Promise<Blob> {
  let path = `/ingest/action/log/${wireEscape(String(uuid))}/events`;
  const selectedAuth = this._selectAuthAlternative("streamActionExecutionEvents", [
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
  if (params?.lastEventId !== undefined) {
    headers["Last-Event-ID"] = String(params.lastEventId);
  }
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
      operationId: "streamActionExecutionEvents",
      pathTemplate: "/ingest/action/log/{uuid}/events",
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
