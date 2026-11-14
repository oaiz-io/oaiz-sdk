// Mirrors the OAIZ server's function calls: validating and resolving a call, the catalog read, the
// compiled statement and the transaction a call runs in.

import type { TestDatabase } from "../database";
import { compareCodePoints, stringifyJson, type JsonObject, type JsonValue } from "../json";
import {
  databaseEditRequiredError,
  functionCallInvalidError,
  functionNotFoundError,
  functionResultTooLargeError,
} from "./errors";
import { documentStatement, prelude, step, type RowsCaller } from "./execute";
import type { FunctionCallInput } from "./request";
import type { TableStatement } from "./table";

/** The most rows or values one call returns, as domain.MaxCustomerSQLRows sets it. */
const maxFunctionCallRows = 1000;
/** The most named arguments one call passes. PostgreSQL takes at most 100 arguments. */
const maxFunctionCallArgs = 100;
/** The longest name PostgreSQL keeps, in bytes. */
const maxObjectNameBytes = 63;
/** A name a call reaches without quoting: a plain identifier that does not start with _. */
const functionNamePattern = /^[A-Za-z][A-Za-z0-9_]*$/;
/** Name prefixes the platform and the PostgreSQL catalogue keep, compared case-folded. */
const reservedPrefixes = ["oaiz_", "pg_"];

/**
 * The query the OAIZ server reads a schema's functions with: every function of the data schema
 * named $1, as one JSON array.
 */
export const functionCatalogQuery = `SELECT coalesce(pg_catalog.json_agg(pg_catalog.json_build_object(
  'name', p.proname,
  'volatility', p.provolatile,
  'returnsSet', p.proretset,
  'returns', CASE
    WHEN p.prorettype IN ('pg_catalog.trigger'::pg_catalog.regtype, 'pg_catalog.event_trigger'::pg_catalog.regtype) THEN 'trigger'
    WHEN p.prorettype = 'pg_catalog.void'::pg_catalog.regtype THEN 'void'
    WHEN p.proargmodes && ARRAY['o', 'b', 't']::pg_catalog."char"[] THEN 'row'
    WHEN base.typtype = 'c' THEN 'row'
    WHEN base.typtype = 'p' THEN 'unsupported'
    ELSE 'scalar' END,
  'inputs', coalesce((
    SELECT pg_catalog.json_agg(pg_catalog.json_build_object(
      'name', coalesce(i.name, ''),
      'mode', i.mode,
      'type', pg_catalog.format_type(i.type, NULL),
      'pseudo', t.typtype = 'p',
      'hasDefault', i.position > p.pronargs - p.pronargdefaults) ORDER BY i.position)
    FROM (
      SELECT a.type, p.proargnames[a.ordinality] AS name, coalesce(p.proargmodes[a.ordinality], 'i') AS mode,
             pg_catalog.row_number() OVER (ORDER BY a.ordinality) AS position
      FROM pg_catalog.unnest(coalesce(p.proallargtypes, p.proargtypes::pg_catalog.oid[])) WITH ORDINALITY AS a(type, ordinality)
      WHERE coalesce(p.proargmodes[a.ordinality], 'i') IN ('i', 'b', 'v')
    ) AS i
    JOIN pg_catalog.pg_type t ON t.oid = i.type), '[]'::pg_catalog.json)) ORDER BY p.oid), '[]'::pg_catalog.json)::pg_catalog.text
FROM pg_catalog.pg_proc p
CROSS JOIN LATERAL (
  WITH RECURSIVE chain(typtype, typbasetype, depth) AS (
    SELECT t.typtype, t.typbasetype, 0 FROM pg_catalog.pg_type t WHERE t.oid = p.prorettype
    UNION ALL
    SELECT t.typtype, t.typbasetype, chain.depth + 1
    FROM chain JOIN pg_catalog.pg_type t ON t.oid = chain.typbasetype
    WHERE chain.typtype = 'd'
  )
  SELECT chain.typtype FROM chain ORDER BY chain.depth DESC LIMIT 1
) AS base
WHERE p.pronamespace = 'data'::pg_catalog.regnamespace AND p.proname = $1 AND p.prokind = 'f'`;

type FunctionReturnKind = "void" | "scalar" | "row" | "trigger" | "unsupported";

/** One function functionCatalogQuery read. */
interface CatalogFunction {
  name: string;
  /** pg_proc.provolatile: i, s or v. */
  volatility: string;
  returnsSet: boolean;
  returns: FunctionReturnKind;
  /** The IN, INOUT and VARIADIC inputs in call order; mode is i, b or v. */
  inputs: { name: string; mode: string; type: string; pseudo: boolean; hasDefault: boolean }[];
}

/** A call admitted against the function it calls. */
interface ResolvedFunctionCall {
  name: string;
  args: { name: string; type: string }[];
  argValues: string;
  returnsSet: boolean;
  returns: FunctionReturnKind;
  readOnly: boolean;
}

/**
 * Runs one function call that decodeFunctionCall admitted as caller and answers the JSON text of
 * what the function returned. A STABLE or IMMUTABLE function runs in a transaction that refuses
 * every change.
 */
export async function runFunctionCall(
  database: TestDatabase,
  caller: RowsCaller,
  call: FunctionCallInput,
): Promise<string | null> {
  const args: JsonObject = call.args ?? new Map();
  return database.exclusive(async (session) => {
    await step(
      session,
      "begin isolation level read committed read write",
      [],
      "failed to prepare the bounded transaction",
    );
    try {
      await prelude(session, caller);
      const [[document]] = await step(session, functionCatalogQuery, [call.name], "query failed");
      const resolved = resolveFunctionCall(
        call.name,
        args,
        JSON.parse(document as string) as CatalogFunction[],
        caller,
      );
      if (resolved.readOnly) {
        await step(session, "SET TRANSACTION READ ONLY", [], "statement failed");
      }
      const statement = compileFunctionCall(resolved);
      const result = await documentStatement(session, statement.sql, statement.args);
      if (result.returned > maxFunctionCallRows) {
        throw functionResultTooLargeError(maxFunctionCallRows);
      }
      await step(
        session,
        "COMMIT",
        [],
        resolved.readOnly
          ? "failed to commit the bounded transaction"
          : "failed to complete the bounded transaction",
      );
      return result.body;
    } catch (error) {
      await session.query("ROLLBACK", []).catch(() => undefined);
      throw error;
    }
  });
}

/**
 * Refuses a call before any database reads it. A name a caller can never call is a function that
 * does not exist, so a caller learns nothing about the functions outside the ones it may call.
 */
export function validateFunctionCall(call: FunctionCallInput): void {
  if (new TextEncoder().encode(call.name).length > maxObjectNameBytes) {
    throw functionCallInvalidError("the function name is longer than a PostgreSQL identifier");
  }
  const folded = call.name.toLowerCase();
  if (
    !functionNamePattern.test(call.name) ||
    reservedPrefixes.some((prefix) => folded.startsWith(prefix))
  ) {
    throw functionNotFoundError(call.name);
  }
  if ((call.args?.size ?? 0) > maxFunctionCallArgs) {
    throw functionCallInvalidError(
      `a function call passes at most ${maxFunctionCallArgs} arguments`,
    );
  }
}

function resolveFunctionCall(
  name: string,
  args: Map<string, JsonValue>,
  entries: CatalogFunction[],
  caller: RowsCaller,
): ResolvedFunctionCall {
  if (entries.length === 0) throw functionNotFoundError(name);
  if (entries.length > 1) {
    throw functionCallInvalidError(`the database holds more than one function named ${name}`);
  }
  const [entry] = entries;
  if (entry.returns === "trigger") throw functionNotFoundError(name);
  if (entry.returns === "unsupported") {
    throw functionCallInvalidError(`the function ${name} returns a type a call cannot read`);
  }

  const resolved: ResolvedFunctionCall = {
    name: entry.name,
    args: [],
    argValues: "",
    returnsSet: entry.returnsSet,
    returns: entry.returns,
    readOnly: entry.volatility !== "v",
  };
  const taken = new Set<string>();
  for (const input of entry.inputs) {
    if (input.name === "") {
      throw functionCallInvalidError(`the function ${name} has an input without a name`);
    }
    if (input.mode === "v") {
      throw functionCallInvalidError(`the function ${name} takes VARIADIC input ${input.name}`);
    }
    if (input.pseudo) {
      throw functionCallInvalidError(
        `the function ${name} takes input ${input.name} of pseudo-type ${input.type}`,
      );
    }
    taken.add(input.name);
    if (args.has(input.name)) resolved.args.push({ name: input.name, type: input.type });
    else if (!input.hasDefault) {
      throw functionCallInvalidError(`the function ${name} requires argument ${input.name}`);
    }
  }
  const unknown = [...args.keys()].filter((arg) => !taken.has(arg)).sort(compareCodePoints);
  if (unknown.length !== 0) {
    throw functionCallInvalidError(`the function ${name} has no argument ${unknown[0]}`);
  }
  if (!resolved.readOnly && caller.capability !== "edit") throw databaseEditRequiredError();
  if (resolved.args.length !== 0) {
    resolved.argValues = stringifyJson(
      new Map(resolved.args.map((arg) => [arg.name, args.get(arg.name)])),
    );
  }
  return resolved;
}

/**
 * The one statement that runs a resolved call and answers its document: no total, the rows the
 * function returned, and the body. The argument values travel only in $1, as one JSON object that
 * json_to_record turns into one row of the inputs' own types, each passed to its input by name.
 */
function compileFunctionCall(call: ResolvedFunctionCall): TableStatement {
  const fn = `${quoteIdentifier("data")}.${quoteIdentifier(call.name)}`;
  let source: string;
  let args: string[] = [];
  if (call.args.length !== 0) {
    const columns = call.args.map((arg) => `${quoteIdentifier(arg.name)} ${arg.type}`);
    const named = call.args.map(
      (arg) => `${quoteIdentifier(arg.name)} => r.${quoteIdentifier(arg.name)}`,
    );
    source = `pg_catalog.json_to_record($1::pg_catalog.json) AS r(${columns.join(", ")}), LATERAL ${fn}(${named.join(", ")})`;
    args = [call.argValues];
  } else {
    source = `${fn}()`;
  }

  let item: string;
  let inner: string;
  switch (call.returns) {
    case "row":
      [item, inner] = ["pg_catalog.to_json(o.*)", `SELECT f.* FROM ${source} AS f`];
      break;
    case "void":
      [item, inner] = ["NULL::pg_catalog.json", `SELECT FROM ${source} AS f`];
      break;
    default:
      [item, inner] = ["pg_catalog.to_json(o.v)", `SELECT f.v FROM ${source} AS f(v)`];
  }
  const aggregate = call.returnsSet
    ? "coalesce(pg_catalog.json_agg(result.v), '[]'::pg_catalog.json)"
    : "(pg_catalog.json_agg(result.v) -> 0)";
  const sql =
    `SELECT NULL::pg_catalog.int8, pg_catalog.count(*), ${aggregate}::pg_catalog.text FROM (\n` +
    `SELECT ${item} AS v FROM (\n${inner}\nLIMIT ${maxFunctionCallRows + 1}\n) AS o\n) AS result`;
  return { sql, args };
}

function quoteIdentifier(name: string): string {
  return `"${name.replaceAll("\0", "").replaceAll('"', '""')}"`;
}
