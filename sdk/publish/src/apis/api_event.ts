import type { Client, RequestOptions, PublishEventBody } from "../client";
import { ApiError } from "../errors";
import * as models from "../models";

/**
 * Publish an event.
 *
 * Publish a new event as a JSON body, or as multipart form data with an 'event' JSON string plus optional 'files' uploads.
 * An app access token is admitted; the app publishes as the signed-in member.
 */
export const publishEvent = async function (
  this: Client,
  body: PublishEventBody,
  options?: RequestOptions,
): Promise<models.DtoCommandMessageWithUUID> {
  let path = `/ingest/event/publish`;
  const selectedAuth = this._selectAuthAlternative("publishEvent", [
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
  if (body.contentType !== "multipart/form-data") {
    headers["Content-Type"] = body.contentType;
  }
  let requestBody: unknown = undefined;
  switch (body.contentType) {
    case "application/json":
      requestBody = JSON.stringify(body.value);
      break;
    case "multipart/form-data":
      requestBody = this._multipartBody(body.value);
      break;
  }
  const res = await this._request(
    "POST",
    path,
    headers,
    requestBody,
    {
      operationId: "publishEvent",
      pathTemplate: "/ingest/event/publish",
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
    return await this._decodeJson<models.DtoCommandMessageWithUUID>(res);
  }
  throw new ApiError(res.status);
};
