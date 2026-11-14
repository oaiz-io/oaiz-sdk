import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { createTestAuth } from "./auth";
import { openTestDatabase, type TestDatabase } from "./database";
import { parseJson, stringifyJson, type JsonValue } from "./json";
import { defaultGrant, parseMembers, type OaizTestMembers } from "./members";
import { RowsRefusal } from "./rows/errors";
import { runRowsRequest, type RowsCaller } from "./rows/execute";
import { runFunctionCall } from "./rows/functions";
import { decodeFunctionCall, decodeRowsRequest, type RowsOperation } from "./rows/request";
import type { TableReadResult } from "./rows/table";

export interface OaizTestServerOptions {
  /**
   * The app's tests folder: `databases/<id>.sql` is the schema of the database with that id,
   * `databases/<id>.seed.sql` its seed, and `members.json` who can sign in.
   */
  directory: string;
}

/** Answers an app's OAIZ requests under `/__oaiz-test/` from one local test database per id. */
export interface OaizTestServer {
  handle(request: Request): Promise<Response>;
  /** An access token that signs memberId in to the app clientId. */
  issueToken(memberId: string, clientId: string): string;
  /**
   * Reads the folder again, then empties every open database and runs its seed. A database whose
   * schema file changed is built again; one whose schema file is gone is closed.
   */
  reset(): Promise<void>;
  close(): Promise<void>;
}

const prefix = "/__oaiz-test/";
const oauthPrefix = `${prefix}oauth/`;

const rowsRoute =
  /^\/__oaiz-test\/storage\/databases\/([^/]+)\/rows\/(select|insert|upsert|update|delete)$/;

const functionCallRoute = /^\/__oaiz-test\/storage\/databases\/([^/]+)\/functions\/call$/;

const unsupported = {
  slug: "test-mode-unsupported",
  message:
    "OAIZ test mode runs sign-in, row requests and function calls only. Tools, events, workflow runs, model calls, embeddings and chat need OAIZ.",
};

/** The OAIZ server's answer for a database the app holds no grant on. */
const databaseNotFound = {
  message: "the managed database was not found",
  slug: "storage-database-access-denied",
};

/** One database's two files, as read from the folder. */
interface DatabaseFiles {
  schemaSQL: string;
  seedSQL: string;
}

/** What the folder holds: the members file and every database's files, by lower-case id. */
interface TestFiles {
  members: OaizTestMembers;
  databases: Map<string, DatabaseFiles>;
}

/** A database the server has built, from schemaSQL. */
interface OpenDatabase {
  schemaSQL: string;
  database: Promise<TestDatabase>;
}

/**
 * Reads the folder and signs in its members. A database is built from its schema and seeded on its
 * first request, so a test that reads one of an app's databases runs one PGlite.
 */
export async function createTestServer(options: OaizTestServerOptions): Promise<OaizTestServer> {
  let files = await readTestFiles(options.directory);
  const open = new Map<string, OpenDatabase>();

  const build = (id: string, database: DatabaseFiles): OpenDatabase => {
    const built = (async () => {
      const opened = await openTestDatabase(database.schemaSQL, databaseFile(id, ".sql"));
      try {
        await seed(opened, id, database.seedSQL);
      } catch (error) {
        await opened.close();
        throw error;
      }
      return opened;
    })();
    const entry = { schemaSQL: database.schemaSQL, database: built };
    // A database that fails to build is not kept, so the next request builds it again from its files.
    built.catch(() => {
      if (open.get(id) === entry) open.delete(id);
    });
    open.set(id, entry);
    return entry;
  };

  const databaseFor = (id: string): Promise<TestDatabase> | undefined => {
    const database = files.databases.get(id);
    if (database === undefined) return undefined;
    return (open.get(id) ?? build(id, database)).database;
  };

  const auth = createTestAuth(() => files.members.members);

  /**
   * Signs the request in, reads its body with decode before it looks the database up, as the OAIZ server
   * does, and answers what run returns as a 200 JSON body, or the OAIZ server's refusal.
   */
  async function storageRequest<Decoded>(
    request: Request,
    id: string,
    decode: (body: string) => Decoded,
    run: (database: TestDatabase, caller: RowsCaller, decoded: Decoded) => Promise<string>,
  ): Promise<Response> {
    const signedIn = auth.authenticate(request);
    if (signedIn instanceof Response) return signedIn;
    const caller: RowsCaller = {
      subject: signedIn.member.id,
      organisationRole: signedIn.member.role ?? "member",
      teams: signedIn.member.teams ?? [],
      capability: files.members.grants[id] ?? defaultGrant,
      app: signedIn.clientId,
    };
    try {
      const decoded = decode(await request.text());
      const database = databaseFor(id);
      if (database === undefined) return json(404, databaseNotFound);
      return new Response(await run(await database, caller, decoded), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    } catch (error) {
      if (error instanceof RowsRefusal) return json(error.status, error.body());
      throw error;
    }
  }

  const rows = (request: Request, id: string, operation: RowsOperation) =>
    storageRequest(
      request,
      id,
      (body) => decodeRowsRequest(operation, body),
      async (database, caller, decoded) =>
        rowsBody(
          await runRowsRequest(database, caller, decoded),
          (decoded.read ?? decoded.write).singular,
        ),
    );

  const callFunction = (request: Request, id: string) =>
    storageRequest(request, id, decodeFunctionCall, async (database, caller, call) =>
      functionCallBody(await runFunctionCall(database, caller, call)),
    );

  async function reset(): Promise<void> {
    files = await readTestFiles(options.directory);
    const waiting: Promise<unknown>[] = [];
    for (const [id, entry] of [...open]) {
      const database = files.databases.get(id);
      if (database !== undefined && database.schemaSQL === entry.schemaSQL) {
        // A database whose reset fails refuses all later work, so the next request builds it
        // again from its files.
        waiting.push(
          entry.database
            .then((opened) => seed(opened, id, database.seedSQL))
            .catch(async (error: unknown) => {
              if (open.get(id) === entry) open.delete(id);
              await closeQuietly(entry);
              throw error;
            }),
        );
        continue;
      }
      open.delete(id);
      waiting.push(closeQuietly(entry));
      if (database !== undefined) waiting.push(build(id, database).database);
    }
    await Promise.all(waiting);
  }

  return {
    async handle(request) {
      const path = new URL(request.url).pathname;
      const route = rowsRoute.exec(path);
      const functionRoute = route ? null : functionCallRoute.exec(path);
      if (route || functionRoute) {
        // The OAIZ server registers the rows and function call routes for POST only; its router answers any
        // other method with this 404.
        if (request.method !== "POST") {
          return new Response("404 page not found", {
            status: 404,
            headers: { "content-type": "text/plain" },
          });
        }
        if (route) {
          return rows(request, databaseId(route[1]), route[2] as RowsOperation);
        }
        return callFunction(request, databaseId(functionRoute![1]));
      }
      if (path.startsWith(oauthPrefix)) {
        const answer = await auth.handle(request, path.slice(oauthPrefix.length));
        if (answer !== undefined) return answer;
      }
      return json(501, unsupported);
    },
    issueToken: (memberId, clientId) => auth.issueToken(memberId, clientId),
    reset,
    async close() {
      const entries = [...open.values()];
      open.clear();
      await Promise.all(entries.map(closeQuietly));
    },
  };
}

/** The database id a path names, as the folder keys it. */
function databaseId(segment: string): string {
  return decodeURIComponent(segment).toLowerCase();
}

/** Closes a database; one that failed to build has nothing to close. */
function closeQuietly(entry: OpenDatabase): Promise<void> {
  return entry.database.then((opened) => opened.close(), () => undefined);
}

/** The path of one database file, as an error names it. */
function databaseFile(id: string, suffix: ".sql" | ".seed.sql"): string {
  return `tests/databases/${id}${suffix}`;
}

async function seed(database: TestDatabase, id: string, seedSQL: string): Promise<void> {
  try {
    await database.reset(seedSQL);
  } catch (error) {
    if (error instanceof RowsRefusal) throw error;
    throw new Error(
      `${databaseFile(id, ".seed.sql")} does not run on its test database: ${(error as Error).message}`,
      { cause: error },
    );
  }
}

/**
 * Reads members.json and databases/. No members file is a test organisation with no members, and
 * no databases folder an app with no databases. A seed file needs its schema file.
 */
async function readTestFiles(directory: string): Promise<TestFiles> {
  const membersText = await readOptional(join(directory, "members.json"));
  const members =
    membersText === undefined
      ? { teams: [], members: [], grants: {} }
      : parseMembers(membersText, "tests/members.json");

  const folder = join(directory, "databases");
  let names: string[];
  try {
    names = await readdir(folder);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    names = [];
  }
  const schemas = new Map<string, string>();
  const seeds = new Map<string, string>();
  for (const name of names.sort()) {
    const lower = name.toLowerCase();
    if (lower.endsWith(".seed.sql")) {
      seeds.set(lower.slice(0, -".seed.sql".length), await readFile(join(folder, name), "utf8"));
    } else if (lower.endsWith(".sql")) {
      schemas.set(lower.slice(0, -".sql".length), await readFile(join(folder, name), "utf8"));
    }
  }
  const databases = new Map<string, DatabaseFiles>();
  for (const [id, schemaSQL] of schemas) {
    databases.set(id, { schemaSQL, seedSQL: seeds.get(id) ?? "" });
  }
  for (const id of seeds.keys()) {
    if (!schemas.has(id)) {
      throw new Error(`${databaseFile(id, ".seed.sql")} has no schema file ${databaseFile(id, ".sql")}`);
    }
  }
  return { members, databases };
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * The rows a request returned, keyed as the OAIZ server re-encodes them: keys sorted, numbers with every
 * digit, and `count` only when the request asked for one. A single request answers its row as an
 * array of one.
 */
function rowsBody(result: TableReadResult, single: boolean): string {
  let rows: JsonValue[] = [];
  if (result.body !== null) {
    const document = parseJson(result.body);
    if (single) rows = document === null ? [] : [document];
    else rows = document as JsonValue[];
  }
  const count = result.total === null ? "" : `,"count":${result.total}`;
  return `{"rows":${stringifyJson(rows)}${count}}`;
}

/**
 * What a function call returned, as the OAIZ server re-encodes it: keys sorted and numbers with every digit,
 * and null for void.
 */
function functionCallBody(body: string | null): string {
  return `{"data":${body === null ? "null" : stringifyJson(parseJson(body))}}`;
}

function json(status: number, body: object, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}
