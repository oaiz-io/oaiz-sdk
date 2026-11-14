import type { Client, RequestOptions } from "../client";
import { ApiError } from "../errors";
import * as models from "../models";

/**
 * Execute a single job with SSE progress.
 *
 * Starts the same real deployed workflow execution as POST /ingest/jobs/{jobUuid}/execute and streams root start, trace-scoped execution snapshots, action logs, waiting states, and terminal status over Server-Sent Events. actionExecutionUuid optionally names the root execution with a UUIDv7; a UUID that already names an execution is 409 action-execution-already-exists and runs nothing. A start that fails ends the stream with one root_start_failure frame; a root that fails before it runs ends it with its error log and a failure terminal frame. Every frame has an SSE id that GET /ingest/action/log/{uuid}/events resumes after. The execution runs to its end when the stream closes. The server writes a ping comment frame every 15 seconds while idle so intermediary proxies keep the connection open.
 */
export const executeJobStream = async function (
  this: Client,
  jobUuid: string,
  body: models.DtoJobExecuteRequest,
  options?: RequestOptions,
): Promise<Blob> {
  let path = `/ingest/jobs/${wireEscape(String(jobUuid))}/execute/stream`;
  const selectedAuth = this._selectAuthAlternative("executeJobStream", [
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
      operationId: "executeJobStream",
      pathTemplate: "/ingest/jobs/{jobUuid}/execute/stream",
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

function wireEscape(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase(),
  );
}
