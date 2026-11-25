import { Client, type ListAppUsersParams } from "../client";
import type { DtoAppUserPage } from "../models";
import { AppAuth, type OaizAuth } from "./auth";
import { OaizChat } from "./chat";
import { OaizConversations } from "./conversations";
import { OaizEmbeddings } from "./embeddings";
import { OaizEvents } from "./events";
import { OaizLLM } from "./llm";
import { OaizQueryBuilder } from "./query";
import { OaizRuns } from "./runs";
import { sendRaw } from "./raw-request";
import type { OpenStream } from "./sse-stream";
import { OaizTools } from "./tools";
import { failureFrom, type OaizResponse } from "./response";
import type { FunctionName, FunctionReturns, GenericDatabase, RelationName, RpcArgs } from "./types";

interface OaizClientBaseOptions {
  /** The OAIZ API base URL. */
  url: string;
}

/** A client that sends one credential. */
export interface OaizKeyClientOptions extends OaizClientBaseOptions {
  /** An API key, a member access token or an app access token. */
  key: string;
  /** The database for `from` and `rpc`, if you use those methods. */
  database?: string;
  app?: never;
}

/** A client of an app that signs its member in from the browser. */
export interface OaizAppClientOptions extends OaizClientBaseOptions {
  /** The app's ID, which `oaiz view create` prints when it creates the app. */
  app: string;
  /** The id of the database `from` reads and writes and `rpc` calls. */
  database: string;
  key?: never;
}

export type OaizClientOptions = OaizKeyClientOptions | OaizAppClientOptions;

/** Works with OAIZ using one credential and, when selected, one database. */
export class OaizClient<Database extends GenericDatabase = any> {
  /** Sends messages to OAIZ Chat and reads committed thread messages. Use a service account key on your server. */
  readonly conversations: OaizConversations;
  /** Publishes events with this client's credential. */
  readonly events: OaizEvents;
  /** Runs tools with this client's credential. */
  readonly tools: OaizTools;
  /** Turns texts into vectors with this client's credential. */
  readonly embeddings: OaizEmbeddings;
  /** Calls models with this client's credential. */
  readonly llm: OaizLLM;
  /** Starts, follows and reads workflow runs with this client's credential. */
  readonly runs: OaizRuns;

  /** @internal */
  constructor(
    /** @internal */
    protected readonly client: Client,
    private readonly databaseId: string | undefined,
    /** @internal */
    protected readonly open: OpenStream,
  ) {
    this.conversations = new OaizConversations(client, open);
    this.events = new OaizEvents(client);
    this.tools = new OaizTools(client);
    this.embeddings = new OaizEmbeddings(client);
    this.llm = new OaizLLM(client);
    this.runs = new OaizRuns(client, open);
  }

  /** Starts a request on a table or a view of this client's database. A view only reads. */
  from<Table extends RelationName<Database>>(table: Table): OaizQueryBuilder<Database, Table> {
    return new OaizQueryBuilder(this.client, this.selectedDatabase(), table);
  }

  /**
   * Calls a function of this client's database by name, with its arguments by name. An argument
   * with a default may be left out. A function that can change rows needs edit access, and one
   * that reads only runs read-only. Resolves to what the function returned: a value, a row as an
   * object, an array for a set, or null for void.
   */
  async rpc<Name extends FunctionName<Database>>(
    name: Name,
    ...[args]: RpcArgs<Database, Name>
  ): Promise<OaizResponse<FunctionReturns<Database, Name>>> {
    try {
      const answer = await this.client.callStorageDatabaseFunction(
        this.selectedDatabase(),
        args === undefined ? { name } : { name, args: args as Record<string, unknown> },
      );
      return { data: (answer.data ?? null) as FunctionReturns<Database, Name>, error: null, count: null, status: 200 };
    } catch (error) {
      return failureFrom(error);
    }
  }

  /** The same client on another database, with the same key. */
  database(id: string): OaizClient<Database> {
    return new OaizClient<Database>(this.client, id, this.open);
  }

  private selectedDatabase(): string {
    if (this.databaseId === undefined) throw new TypeError("Select an OAIZ database with client.database(id) first.");
    return this.databaseId;
  }
}

/** A database client of an app; every request sends the signed-in member's app access token. */
export class OaizAppClient<Database extends GenericDatabase = any> extends OaizClient<Database> {
  /** @internal */
  constructor(
    client: Client,
    databaseId: string,
    open: OpenStream,
    /** Signs the member in, keeps the session fresh and signs out. */
    readonly auth: OaizAuth,
    /** Chats with an OAIZ agent as the signed-in member. */
    readonly chat: OaizChat,
    private readonly appId: string,
  ) {
    super(client, databaseId, open);
  }

  /** Lists one page of the people who can use this app. Pass `userId` to look up a saved selection. */
  async listUsers(params?: ListAppUsersParams, options?: { signal?: AbortSignal }): Promise<OaizResponse<DtoAppUserPage>> {
    try {
      const data = await this.client.listAppUsers(this.appId, params, { signal: options?.signal });
      return { data, error: null, count: null, status: 200 };
    } catch (error) {
      return failureFrom(error);
    }
  }

  /** The same client on another database, with the same session. */
  database(id: string): OaizAppClient<Database> {
    return new OaizAppClient<Database>(this.client, id, this.open, this.auth, this.chat, this.appId);
  }
}

/**
 * An OAIZ client. Pass `database` and the `Database` type `oaiz db types` writes to type its tables.
 * With `app` it also signs the app's member in: creating it in a browser completes a sign-in the
 * page came back from.
 */
export function createClient<Database extends GenericDatabase = any>(
  options: OaizAppClientOptions,
): OaizAppClient<Database>;
export function createClient<Database extends GenericDatabase = any>(
  options: OaizKeyClientOptions,
): OaizClient<Database>;
export function createClient<Database extends GenericDatabase = any>(
  options: OaizClientOptions,
): OaizClient<Database> {
  const { key, app } = options;
  if (key !== undefined && app === undefined) {
    const client = new Client({ baseUrl: options.url, bearerToken: key });
    return new OaizClient<Database>(client, options.database, streamOpener(options.url, async () => key));
  }
  if (app !== undefined && key === undefined) {
    const auth = new AppAuth(options.url, app);
    const client = new Client({
      baseUrl: options.url,
      authMode: "transport",
      hooks: {
        request: [
          async (_context, init) => {
            const token = await auth.accessToken();
            if (token !== undefined) {
              (init.headers as Record<string, string>).Authorization = `Bearer ${token}`;
            }
          },
        ],
      },
    });
    const open = streamOpener(options.url, () => auth.accessToken());
    return new OaizAppClient<Database>(client, options.database, open, auth, new OaizChat(client, open, app, auth, options.url), app);
  }
  throw new TypeError("createClient needs exactly one of key and app.");
}

/** The generated client buffers a response body, so run and chat streams are raw requests with the same credential. */
function streamOpener(url: string, token: () => Promise<string | undefined>): OpenStream {
  return async (request, body, signal) => {
    const headers: Record<string, string> = { Accept: "text/event-stream" };
    const credential = await token();
    if (credential !== undefined) headers.Authorization = `Bearer ${credential}`;
    return sendRaw(url, request, { headers, body, signal });
  };
}
