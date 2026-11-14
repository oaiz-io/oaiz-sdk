import { ApiError } from "../errors";
import type { DtoHttpError } from "../models";

/** Why OAIZ refused a request, or why no answer arrived. `code` names the reason in a stable form, such as `auth-signed-out`. */
export interface OaizError {
  message: string;
  code: string;
  hints: string[];
}

/** Every builder resolves to this; it never throws. `status` is 0 when no answer arrived. */
export type OaizResponse<T> =
  | { data: T; error: null; count: number | null; status: number }
  | { data: null; error: OaizError; count: null; status: number };

/** The code OAIZ answers for a request it cannot read, used for a request the builder refuses to send. */
export const REQUEST_INVALID_CODE = "storage-table-request-invalid";

export function failure(
  status: number,
  error: OaizError,
): OaizResponse<never> {
  return { data: null, error, count: null, status };
}

/** Maps a refusal from OAIZ to its status and code, and anything else to status 0. */
export function failureFrom(cause: unknown): OaizResponse<never> {
  if (cause instanceof ApiError) {
    const body = isHttpError(cause.body) ? cause.body : undefined;
    return failure(cause.status, {
      message: body?.message ?? cause.message,
      code: body?.slug ?? "",
      hints: body?.hints ?? [],
    });
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  return failure(0, { message, code: "", hints: [] });
}

function isHttpError(body: unknown): body is DtoHttpError {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { message?: unknown }).message === "string"
  );
}
