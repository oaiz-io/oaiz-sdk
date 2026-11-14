import type { PGlite } from "@electric-sql/pglite";

import { incorrectInput, RowsRefusal } from "./rows/errors";

/** One statement at a time on the test database; rows come back as arrays, bigints as their digits. */
export interface TestSession {
  query(sql: string, args: string[]): Promise<unknown[][]>;
  /** Runs a script of statements with no parameters, such as a seed file. */
  exec(sql: string): Promise<void>;
}

/** One test database: PGlite holding one database's test schema and its seed rows. */
export interface TestDatabase {
  /** Runs fn alone on the database, so one request's transaction never interleaves with another's. */
  exclusive<T>(fn: (session: TestSession) => Promise<T>): Promise<T>;
  /**
   * Empties every table, restarts its sequences and runs seedSQL. A seed can end the reset's
   * transaction itself, so after a reset fails every later operation but close is refused.
   */
  reset(seedSQL: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * The roles and schemas every test schema writes ahead of a database's own objects. An empty schema
 * file is a database with no tables, which answers every table as missing, as the OAIZ server does.
 */
const emptyDatabaseSQL = `CREATE ROLE "oaiz_test_read" NOLOGIN;
CREATE ROLE "oaiz_test_write" NOLOGIN;
CREATE ROLE "oaiz_test_owner" NOLOGIN;
CREATE SCHEMA "data";
CREATE SCHEMA "oaiz_private";
GRANT USAGE ON SCHEMA "data" TO "oaiz_test_read", "oaiz_test_write", "oaiz_test_owner";
GRANT USAGE ON SCHEMA "oaiz_private" TO "oaiz_test_read", "oaiz_test_write", "oaiz_test_owner";`;

const int8 = 20;
// A local file runs as a superuser, which can give IVFFlat's handler another access method name,
// so an index passes only when its method is implemented by a built-in or the HNSW handler.
const vectorIndexesSQL = `SELECT 1 FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_am a ON a.oid = c.relam
  JOIN pg_catalog.pg_proc p ON p.oid = a.amhandler
  WHERE a.amtype = 'i'
    AND p.prosrc NOT IN ('bthandler', 'hashhandler', 'gisthandler', 'ginhandler', 'spghandler', 'brinhandler', 'hnswhandler')
  LIMIT 1`;

function requireSupportedIndexes(indexes: unknown[]): void {
  if (indexes.length > 0) {
    throw incorrectInput(
      "IVFFlat indexes are refused; use HNSW for a supported vector index",
      "storage-vector-index-refused",
    );
  }
}

/**
 * The extensions an Owner may install in a managed database, loaded into every test database so
 * a test schema's CREATE EXTENSION finds each one. Only the statement installs one, as on the OAIZ server.
 */
async function managedExtensions() {
  const [
    { btree_gin },
    { btree_gist },
    { citext },
    { fuzzystrmatch },
    { hstore },
    { intarray },
    { ltree },
    { pg_trgm },
    { pgcrypto },
    { unaccent },
    { uuid_ossp },
    { vector },
  ] = await Promise.all([
    import("@electric-sql/pglite/contrib/btree_gin"),
    import("@electric-sql/pglite/contrib/btree_gist"),
    import("@electric-sql/pglite/contrib/citext"),
    import("@electric-sql/pglite/contrib/fuzzystrmatch"),
    import("@electric-sql/pglite/contrib/hstore"),
    import("@electric-sql/pglite/contrib/intarray"),
    import("@electric-sql/pglite/contrib/ltree"),
    import("@electric-sql/pglite/contrib/pg_trgm"),
    import("@electric-sql/pglite/contrib/pgcrypto"),
    import("@electric-sql/pglite/contrib/unaccent"),
    import("@electric-sql/pglite/contrib/uuid_ossp"),
    import("@electric-sql/pglite-pgvector"),
  ]);
  return {
    btree_gin,
    btree_gist,
    citext,
    fuzzystrmatch,
    hstore,
    intarray,
    ltree,
    pg_trgm,
    pgcrypto,
    unaccent,
    uuid_ossp,
    vector,
  };
}

/** Boots an in-memory PGlite and runs schemaSQL, the text of the file `what` names, in it. */
export async function openTestDatabase(schemaSQL: string, what: string): Promise<TestDatabase> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg: PGlite = await PGlite.create({ extensions: await managedExtensions() });
  // OAIZ's servers run in UTC, so a timestamptz renders with +00:00.
  await pg.exec("SET TimeZone TO 'UTC'");
  try {
    await pg.exec(schemaSQL.trim() === "" ? emptyDatabaseSQL : schemaSQL);
    // Schema files are local SQL, so they also pass the vector-index policy before being served.
    requireSupportedIndexes((await pg.query(vectorIndexesSQL)).rows);
  } catch (error) {
    await pg.close();
    if (error instanceof RowsRefusal) throw error;
    const reason = (error as Error).message;
    throw new Error(`${what} does not run on the test database: ${reason}`, { cause: error });
  }
  // Every request assumes one of these roles, and `oaiz db test-schema` writes both.
  const roles = (await pg.query<{ rolname: string }>(
    "SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN ('oaiz_test_read', 'oaiz_test_write')",
  )).rows.map((row) => row.rolname);
  const missing = ["oaiz_test_read", "oaiz_test_write"].find((role) => !roles.includes(role));
  if (missing !== undefined) {
    await pg.close();
    throw new Error(
      `${what} creates no role ${missing}, so it is not the output of \`oaiz db test-schema\`. ` +
        `Write the file with \`oaiz db test-schema <database-id> -o ${what}\`; a hand-written CREATE TABLE file does not work.`,
    );
  }

  // Every value reaches PostgreSQL as the text it is, which the input function of its placeholder's
  // type reads, as the OAIZ server's untyped text parameters are read. PGlite's own serializers refuse text
  // for some types, such as bytea.
  const asText = (value: string) => value;
  const serializers = Object.fromEntries(Object.keys(pg.serializers).map((type) => [type, asText]));
  const session: TestSession = {
    async query(sql, args) {
      const result = await pg.query<unknown[]>(sql, args, {
        rowMode: "array",
        parsers: { [int8]: (value: string) => value },
        serializers,
      });
      return result.rows;
    },
    async exec(sql) {
      await pg.exec(sql);
    },
  };
  let queue: Promise<unknown> = Promise.resolve();
  let failedReset: Error | undefined;
  const serialized = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn);
    queue = run.catch(() => undefined);
    return run;
  };
  const exclusive = <T>(fn: (session: TestSession) => Promise<T>): Promise<T> =>
    serialized(() => {
      if (failedReset !== undefined) throw failedReset;
      return fn(session);
    });

  return {
    exclusive,
    reset: (seedSQL) => exclusive(async (session) => {
      await session.exec("BEGIN");
      try {
        await resetRows(session, seedSQL);
        requireSupportedIndexes(await session.query(vectorIndexesSQL, []));
        await session.exec("COMMIT");
      } catch (error) {
        failedReset = new Error("the test database was discarded because its reset failed", { cause: error });
        await session.exec("ROLLBACK");
        throw error;
      }
    }),
    close: () => serialized(() => pg.close()),
  };
}

/**
 * Runs as the database superuser, whom no row policy binds: empties every data table, restarts its
 * identity and serial sequences, and runs the seed. A seed that inserts rows without their ids
 * therefore numbers them 1, 2, 3 on every reset.
 */
async function resetRows(session: TestSession, seedSQL: string): Promise<void> {
  const every = await session.query(
    "SELECT format('data.%I', tablename) FROM pg_catalog.pg_tables WHERE schemaname = 'data' ORDER BY tablename",
    [],
  );
  if (every.length > 0) {
    await session.query(
      `TRUNCATE ${every.map(([name]) => name).join(", ")} RESTART IDENTITY CASCADE`,
      [],
    );
  }
  if (seedSQL.trim() !== "") await session.exec(seedSQL);
}
