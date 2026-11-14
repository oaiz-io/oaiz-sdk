// Mirrors the OAIZ server's errors for rows requests and function calls, and the error bodies the OAIZ server's
// HTTP server answers with.

export const slugTableRequestInvalid = "storage-table-request-invalid";
const slugTableNotFound = "storage-table-not-found";
const slugStatementTimeout = "storage-statement-timeout";
const slugCustomerSQLFailed = "storage-customer-sql-failed";
const slugCustomerSQLPermissionDenied = "storage-customer-sql-permission-denied";
const slugBoundedTransactionFailed = "storage-bounded-transaction-failed";
const slugFunctionNotFound = "storage-function-not-found";
const slugFunctionCallInvalid = "storage-function-call-invalid";
const slugFunctionResultTooLarge = "storage-function-result-too-large";
const slugDatabaseEditRequired = "storage-database-edit-required";

/** One field a request body got wrong, as the OAIZ server's validation answer names it. */
export interface FieldError {
  field: string;
  message: string;
}

/** A refused rows request: the status and the body the OAIZ server answers it with. */
export class RowsRefusal extends Error {
  constructor(
    readonly status: number,
    readonly slug: string,
    message: string,
    readonly errors?: FieldError[],
  ) {
    super(message);
  }

  body(): { message: string; slug: string; errors?: FieldError[] } {
    return this.errors
      ? { message: this.message, slug: this.slug, errors: this.errors }
      : { message: this.message, slug: this.slug };
  }
}

// A customerrors value renders as "<type>: <message>".
export function incorrectInput(message: string, slug: string): RowsRefusal {
  return new RowsRefusal(400, slug, `incorrect-input: ${message}`);
}

function forbidden(message: string, slug: string): RowsRefusal {
  return new RowsRefusal(403, slug, `forbidden: ${message}`);
}

function notFound(message: string, slug: string): RowsRefusal {
  return new RowsRefusal(404, slug, `not-found: ${message}`);
}

function externalService(message: string, slug: string): RowsRefusal {
  return new RowsRefusal(500, slug, `external-service: ${message}`);
}

/** Why a table request was refused. */
export type TableRequestErrorKind =
  | "invalid"
  | "unsupported"
  | "limit-exceeded"
  | "table-not-found"
  | "column-not-found"
  | "embed-path-not-found"
  | "relationship-not-found"
  | "relationship-ambiguous"
  | "singular-mismatch"
  | "invalid-body"
  | "payload-column-not-found"
  | "filter-required";

export function tableRequestError(kind: TableRequestErrorKind, message: string): RowsRefusal {
  const slug = kind === "table-not-found" ? slugTableNotFound : slugTableRequestInvalid;
  return new RowsRefusal(400, slug, `incorrect-input: ${message}`);
}

export function tableNotFoundError(table: string): RowsRefusal {
  return tableRequestError("table-not-found", `the table ${table} does not exist`);
}

export function columnNotFoundError(table: string, column: string): RowsRefusal {
  return tableRequestError("column-not-found", `column ${table}.${column} does not exist`);
}

export function embedPathNotFoundError(path: string): RowsRefusal {
  return tableRequestError(
    "embed-path-not-found",
    `${path} is not an embedded table of this request; embed it in the select`,
  );
}

export function invalidBodyError(message: string): RowsRefusal {
  return tableRequestError("invalid-body", message);
}

export function payloadColumnNotFoundError(table: string, column: string): RowsRefusal {
  return tableRequestError(
    "payload-column-not-found",
    `the table ${table} has no column ${column}`,
  );
}

/** Refuses an update or delete of every row, in the words of the pg-safeupdate extension. */
export function filterRequiredError(kind: "update" | "delete"): RowsRefusal {
  return tableRequestError("filter-required", `${kind.toUpperCase()} requires a WHERE clause`);
}

export function limitError(message: string): RowsRefusal {
  return tableRequestError("limit-exceeded", message);
}

export function singularMismatchError(rows: number): RowsRefusal {
  return tableRequestError(
    "singular-mismatch",
    `single requires exactly one row, and the result has ${rows}`,
  );
}

/**
 * PostgreSQL refusing a compiled statement for a reason in the request. It carries the server's
 * message and hint and never its detail, which can quote a row a row policy hides.
 */
export function statementFailure(
  sqlState: string,
  message: string,
  hint: string | undefined,
): RowsRefusal {
  let text = `${message} (sqlstate ${sqlState})`;
  if (hint) text += `\nHint: ${hint}`;
  if (sqlState === "42501") return forbidden(text, slugCustomerSQLPermissionDenied);
  return incorrectInput(text, slugCustomerSQLFailed);
}

/** Limit `set_config('statement_timeout')` applies. The refusal names this value. */
export const statementTimeoutLimit = "30s";

export function statementTimeoutError(): RowsRefusal {
  return new RowsRefusal(
    503,
    slugStatementTimeout,
    `statement-timeout: the statement exceeded the statement timeout of ${statementTimeoutLimit}`,
  );
}

export function boundedTxFailure(message: string, sqlState: string): RowsRefusal {
  return externalService(`${message} (sqlstate ${sqlState})`, slugBoundedTransactionFailed);
}

/**
 * A function the caller cannot call: one the data schema does not hold, a trigger function, or a
 * name a call can never reach.
 */
export function functionNotFoundError(name: string): RowsRefusal {
  return notFound(`the function ${name} does not exist in the database`, slugFunctionNotFound);
}

/** A function call refused before it ran. */
export function functionCallInvalidError(message: string): RowsRefusal {
  return incorrectInput(message, slugFunctionCallInvalid);
}

export function functionResultTooLargeError(maxRows: number): RowsRefusal {
  return incorrectInput(
    `the function returned more than ${maxRows} rows; return fewer rows`,
    slugFunctionResultTooLarge,
  );
}

/** A change asked of a database by a caller with View access. */
export function databaseEditRequiredError(): RowsRefusal {
  return forbidden("editing this database requires edit access", slugDatabaseEditRequired);
}
