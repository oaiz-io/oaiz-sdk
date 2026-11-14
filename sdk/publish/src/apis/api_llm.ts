import type { Client, RequestOptions } from "../client";
import { ApiError } from "../errors";
import * as models from "../models";

/**
 * Create embeddings.
 *
 * Turn each input text into one vector, in input order, on the named
 * embedding model. An app access token is admitted; the call runs as the
 * signed-in member, within the organisation's budget, on the account the
 * organisation's admin chooses for embeddings in AI feature settings: OAIZ
 * or an organisation OpenAI key.
 */
export const createEmbeddings = async function (
  this: Client,
  body: models.DtoCreateEmbeddingsRequest,
  options?: RequestOptions,
): Promise<models.DtoCreateEmbeddingsResponse> {
  let path = `/ingest/embeddings`;
  const selectedAuth = this._selectAuthAlternative("createEmbeddings", [
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
      operationId: "createEmbeddings",
      pathTemplate: "/ingest/embeddings",
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
    return await this._decodeJson<models.DtoCreateEmbeddingsResponse>(res);
  }
  throw new ApiError(res.status);
};
/**
 * Call a model.
 *
 * Ask one model for one answer to one input text, under an optional system
 * instruction. An app access token is admitted; the call runs as the
 * signed-in member, within the organisation's budget, on a model the
 * organisation permits in both chat and workflows, on OAIZ or on the named
 * organisation provider key.
 */
export const createLlmCall = async function (
  this: Client,
  body: models.DtoCreateLLMCallRequest,
  options?: RequestOptions,
): Promise<models.DtoCreateLLMCallResponse> {
  let path = `/ingest/llm/call`;
  const selectedAuth = this._selectAuthAlternative("createLLMCall", [
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
      operationId: "createLLMCall",
      pathTemplate: "/ingest/llm/call",
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
    return await this._decodeJson<models.DtoCreateLLMCallResponse>(res);
  }
  throw new ApiError(res.status);
};
