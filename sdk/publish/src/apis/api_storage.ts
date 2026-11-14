import type { Client, RequestOptions } from "../client";
import { ApiError } from "../errors";
import * as models from "../models";

/**
 * Call a managed database function.
 *
 * Run one function of the database's data schema with its arguments by name.
 * A VOLATILE function needs edit access and publishes the rows it and its triggers change;
 * a STABLE or IMMUTABLE function runs read-only.
 * The caller's database capability and row policies decide every row the function reads or changes,
 * except in a SECURITY DEFINER function, which runs as the database's migration owner and bypasses row policies.
 * An app access token is admitted; the app reaches the database with its own grant, as the member.
 */
export const callStorageDatabaseFunction = async function (
  this: Client,
  id: string,
  body: models.DtoCallStorageDatabaseFunctionInput,
  options?: RequestOptions,
): Promise<models.DtoStorageDatabaseFunctionResult> {
  let path = `/storage/databases/${wireEscape(String(id))}/functions/call`;
  const selectedAuth = this._selectAuthAlternative("callStorageDatabaseFunction", [
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
      operationId: "callStorageDatabaseFunction",
      pathTemplate: "/storage/databases/{id}/functions/call",
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
    return await this._decodeJson<models.DtoStorageDatabaseFunctionResult>(res);
  }
  throw new ApiError(res.status);
};
/**
 * Delete managed database rows.
 *
 * Remove the rows of one table that the filters match. Setting select returns
 * the removed rows.
 * An app access token is admitted; the app reaches the database with its own grant, as the member.
 */
export const deleteStorageDatabaseRows = async function (
  this: Client,
  id: string,
  body: models.DtoDeleteStorageDatabaseRowsInput,
  options?: RequestOptions,
): Promise<models.DtoStorageDatabaseRows> {
  let path = `/storage/databases/${wireEscape(String(id))}/rows/delete`;
  const selectedAuth = this._selectAuthAlternative("deleteStorageDatabaseRows", [
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
      operationId: "deleteStorageDatabaseRows",
      pathTemplate: "/storage/databases/{id}/rows/delete",
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
    return await this._decodeJson<models.DtoStorageDatabaseRows>(res);
  }
  throw new ApiError(res.status);
};
/**
 * Insert managed database rows.
 *
 * Add rows to one table. Setting select returns the inserted rows.
 * An app access token is admitted; the app reaches the database with its own grant, as the member.
 */
export const insertStorageDatabaseRows = async function (
  this: Client,
  id: string,
  body: models.DtoInsertStorageDatabaseRowsInput,
  options?: RequestOptions,
): Promise<models.DtoStorageDatabaseRows> {
  let path = `/storage/databases/${wireEscape(String(id))}/rows/insert`;
  const selectedAuth = this._selectAuthAlternative("insertStorageDatabaseRows", [
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
      operationId: "insertStorageDatabaseRows",
      pathTemplate: "/storage/databases/{id}/rows/insert",
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
    return await this._decodeJson<models.DtoStorageDatabaseRows>(res);
  }
  throw new ApiError(res.status);
};
/**
 * Select managed database rows.
 *
 * Read rows of one table, with the rows of related tables nested under them.
 * The caller's database capability and row policies decide every row, nested rows included.
 * An app access token is admitted; the app reaches the database with its own grant, as the member.
 */
export const selectStorageDatabaseRows = async function (
  this: Client,
  id: string,
  body: models.DtoSelectStorageDatabaseRowsInput,
  options?: RequestOptions,
): Promise<models.DtoStorageDatabaseRows> {
  let path = `/storage/databases/${wireEscape(String(id))}/rows/select`;
  const selectedAuth = this._selectAuthAlternative("selectStorageDatabaseRows", [
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
      operationId: "selectStorageDatabaseRows",
      pathTemplate: "/storage/databases/{id}/rows/select",
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
    return await this._decodeJson<models.DtoStorageDatabaseRows>(res);
  }
  throw new ApiError(res.status);
};
/**
 * Update managed database rows.
 *
 * Change the rows of one table that the filters match. Setting select returns
 * the changed rows.
 * An app access token is admitted; the app reaches the database with its own grant, as the member.
 */
export const updateStorageDatabaseRows = async function (
  this: Client,
  id: string,
  body: models.DtoUpdateStorageDatabaseRowsInput,
  options?: RequestOptions,
): Promise<models.DtoStorageDatabaseRows> {
  let path = `/storage/databases/${wireEscape(String(id))}/rows/update`;
  const selectedAuth = this._selectAuthAlternative("updateStorageDatabaseRows", [
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
      operationId: "updateStorageDatabaseRows",
      pathTemplate: "/storage/databases/{id}/rows/update",
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
    return await this._decodeJson<models.DtoStorageDatabaseRows>(res);
  }
  throw new ApiError(res.status);
};
/**
 * Upsert managed database rows.
 *
 * Add rows to one table, or change the row that already holds a row's unique
 * key. Setting select returns the written rows.
 * An app access token is admitted; the app reaches the database with its own grant, as the member.
 */
export const upsertStorageDatabaseRows = async function (
  this: Client,
  id: string,
  body: models.DtoUpsertStorageDatabaseRowsInput,
  options?: RequestOptions,
): Promise<models.DtoStorageDatabaseRows> {
  let path = `/storage/databases/${wireEscape(String(id))}/rows/upsert`;
  const selectedAuth = this._selectAuthAlternative("upsertStorageDatabaseRows", [
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
      operationId: "upsertStorageDatabaseRows",
      pathTemplate: "/storage/databases/{id}/rows/upsert",
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
    return await this._decodeJson<models.DtoStorageDatabaseRows>(res);
  }
  throw new ApiError(res.status);
};

function wireEscape(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase(),
  );
}
