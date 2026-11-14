// Mirrors the transaction the OAIZ server runs a rows request in: the prelude, the catalog read, the statement,
// the singular guard and the SQLSTATE classes that name the request's own fault.

import type { TestDatabase, TestSession } from "../database";
import {
  catalogDepth,
  decodeTableCatalog,
  tableCatalogArguments,
  tableCatalogQuery,
} from "./catalog";
import { compileRead, compileWrite } from "./compile";
import {
  boundedTxFailure,
  singularMismatchError,
  statementFailure,
  statementTimeoutError,
  statementTimeoutLimit,
} from "./errors";
import type { RowsRequest } from "./request";
import { resolveTableRead, resolveTableWrite } from "./resolve";
import type { TableReadResult, TableStatement } from "./table";

/** The organisation every test database belongs to, as `oaiz db test-schema` renders it. */
const testOrganisation = "7e570000-0000-4000-8000-00000000000a";
/** The physical database name `oaiz db test-schema` renders the platform policies with. */
const testPhysicalDatabase = "oaiz_test";

/** Who a request runs as: the claims the OAIZ server publishes for an app's member. */
export interface RowsCaller {
  subject: string;
  organisationRole: string;
  teams: string[];
  capability: "view" | "edit";
  app: string;
}

/** Classes that describe the statement rather than the database, as the OAIZ server lists them. */
const customerStatementClasses = new Set([
  "0A", "20", "21", "22", "23", "25", "2D", "2F", "42", "44", "54", "P0",
]);

const singularGuardSQL = `SELECT 1 / CASE
 WHEN pg_catalog.current_setting('oaiz.table_singular_guard', true) = 'ok' THEN 1
 ELSE 0 END`;

/** Runs one rows request as caller, in one transaction that commits only when every step succeeded. */
export function runRowsRequest(
  database: TestDatabase,
  caller: RowsCaller,
  request: RowsRequest,
): Promise<TableReadResult> {
  const readOnly = request.read !== undefined;
  return database.exclusive(async (session) => {
    await step(
      session,
      `begin isolation level read committed ${readOnly ? "read only" : "read write"}`,
      [],
      "failed to prepare the bounded transaction",
    );
    try {
      await prelude(session, caller);
      const scope = request.read ? request.read : request.write;
      const [[document]] = await step(
        session,
        tableCatalogQuery,
        tableCatalogArguments(scope.table, catalogDepth(scope.select)),
        "query failed",
      );
      const catalog = decodeTableCatalog(document as string);
      const result = request.read
        ? await readDocument(
            session,
            compileRead(resolveTableRead(request.read, catalog)),
            request.read.singular,
          )
        : await writeDocument(
            session,
            compileWrite(resolveTableWrite(request.write, catalog)),
            request.write.singular,
          );
      await step(
        session,
        "COMMIT",
        [],
        readOnly
          ? "failed to commit the bounded transaction"
          : "failed to complete the bounded transaction",
      );
      return result;
    } catch (error) {
      await session.query("ROLLBACK", []).catch(() => undefined);
      throw error;
    }
  });
}

/**
 * Publishes caller's claims, assumes its data role and sets the statement timeout and the
 * search_path the transaction's catalog read and statement run with.
 */
export async function prelude(session: TestSession, caller: RowsCaller): Promise<void> {
  await step(
    session,
    "SELECT set_config('client_encoding', 'UTF8', true), set_config('standard_conforming_strings', 'on', true), set_config('hnsw.iterative_scan', 'strict_order', true)",
    [],
    "failed to pin the transaction's parser settings",
  );
  const claims: [string, string][] = [
    ["oaiz.organisation_id", testOrganisation],
    ["oaiz.storage_database", testPhysicalDatabase],
    ["oaiz.subject", caller.subject],
    ["oaiz.organisation_role", caller.organisationRole],
    ["oaiz.teams", caller.teams.join(",")],
    ["oaiz.capability", caller.capability],
    ["oaiz.app", caller.app],
  ];
  await step(
    session,
    `SELECT ${claims.map((_, index) => `set_config($${2 * index + 1}, $${2 * index + 2}, true)`).join(", ")}`,
    claims.flat(),
    "failed to publish the identity claims",
  );
  const role = caller.capability === "view" ? "oaiz_test_read" : "oaiz_test_write";
  await step(session, `SET LOCAL ROLE "${role}"`, [], "failed to assume the managed data role");
  await step(
    session,
    "SELECT set_config('statement_timeout', $1, true)",
    [statementTimeoutLimit],
    "statement failed",
  );
  // Built-in names in catalog and compiled SQL resolve ahead of data, and a
  // managed extension's type or operator resolves after them.
  await step(session, "SET LOCAL search_path TO pg_catalog, extensions, pg_temp", [], "statement failed");
}

/** A singular read sets the guard in the same statement and then divides by zero unless it is one row. */
async function readDocument(
  session: TestSession,
  statement: TableStatement,
  singular: boolean,
): Promise<TableReadResult> {
  let sql = statement.sql;
  if (singular) {
    sql = `SELECT document.total, document.returned, document.body, pg_catalog.set_config('oaiz.table_singular_guard', CASE WHEN document.returned = 1 THEN 'ok' ELSE 'mismatch' END, true) FROM (\n${sql}\n) AS document(total, returned, body)`;
  }
  const result = await documentStatement(session, sql, statement.args);
  if (singular) {
    try {
      await session.query(singularGuardSQL, []);
    } catch (error) {
      if (sqlStateOf(error) === "22012" && result.returned !== 1)
        throw singularMismatchError(result.returned);
      throw documentFailure(error);
    }
  }
  return result;
}

/** A singular write that changed other than one row is refused, so the transaction rolls back. */
async function writeDocument(
  session: TestSession,
  statement: TableStatement,
  singular: boolean,
): Promise<TableReadResult> {
  const result = await documentStatement(session, statement.sql, statement.args);
  if (singular && result.returned !== 1) throw singularMismatchError(result.returned);
  return result;
}

export async function documentStatement(
  session: TestSession,
  sql: string,
  args: string[],
): Promise<TableReadResult> {
  let rows: unknown[][];
  try {
    rows = await session.query(sql, args);
  } catch (error) {
    throw documentFailure(error);
  }
  const [total, returned, body] = rows[0];
  return { total: total as string | null, returned: Number(returned), body: body as string | null };
}

/**
 * PostgreSQL refusing the request itself keeps its SQLSTATE, message and hint; a statement
 * timeout has its own answer; anything else is a bounded-transaction failure.
 */
export function documentFailure(error: unknown): unknown {
  const sqlState = sqlStateOf(error);
  if (sqlState === undefined) return error;
  if (sqlState === "57014") return statementTimeoutError();
  const failure = error as { message: string; hint?: string };
  if (customerStatementClasses.has(sqlState.slice(0, 2)))
    return statementFailure(sqlState, failure.message, failure.hint);
  return boundedTxFailure("query failed", sqlState);
}

/** Runs one prelude statement; any refusal fails the transaction rather than naming the request. */
export async function step(
  session: TestSession,
  sql: string,
  args: string[],
  message: string,
): Promise<unknown[][]> {
  try {
    return await session.query(sql, args);
  } catch (error) {
    const sqlState = sqlStateOf(error);
    if (sqlState === undefined) throw error;
    throw boundedTxFailure(message, sqlState);
  }
}

/** The SQLSTATE of a PostgreSQL error, or undefined for any other error. */
export function sqlStateOf(error: unknown): string | undefined {
  if (!(error instanceof Error) || !("severity" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.length === 5 ? code : undefined;
}
