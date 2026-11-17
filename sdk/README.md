# @oaiz/sdk

[![CI](https://github.com/oaiz-io/oaiz-sdk/actions/workflows/ci.yaml/badge.svg?branch=main)](https://github.com/oaiz-io/oaiz-sdk/actions/workflows/ci.yaml)

The TypeScript client for apps built on [OAIZ](https://oaiz.io). It reads and writes the rows of
an OAIZ database, runs your integrations and OAIZ's built-in tools, starts workflows, publishes
events, calls a model, creates embeddings, and chats with an OAIZ agent, in the browser as a
signed-in member of your organisation or on your server with an API key.

```sh
npm install @oaiz/sdk
```

## In the browser, in an OAIZ app

Give the client your app ID. It signs in a member of your organisation, and every request then runs
as that member, with their access. Where the IDs come from, and where sign-in returns, is under
[Setup](#setup).

```ts
// src/oaiz.ts
import { createClient } from "@oaiz/sdk";

export const oaiz = createClient({
  url: "https://api.oaiz.io",
  database: "<database id>",
  app: "<app id>",
});

export async function openTodos() {
  // Every request needs a signed-in member; without one OAIZ answers 401.
  const { data: session } = await oaiz.auth.getSession();
  if (session === null) {
    // The browser leaves for OAIZ here and comes back to this page, signed in.
    const { error } = await oaiz.auth.signIn();
    if (error) throw new Error(error.message);
    return [];
  }
  const { data, error } = await oaiz.from("todos").select("id, title").eq("done", false);
  if (error) throw new Error(error.message);
  return data;
}
```

```ts
// src/session.ts
import { oaiz } from "./oaiz";

export async function whoIsSignedIn() {
  const { data: session } = await oaiz.auth.getSession();
  if (session === null) return null;
  const { data: user } = await oaiz.auth.getUser();
  return user?.name ?? user?.email ?? null;
}

export async function signOut() {
  await oaiz.auth.signOut();
}
```

The session lives in the tab's `sessionStorage`, and the client renews it before it expires.

## On the server, with an API key

Give the client an API key instead of an app ID. Keep the key on the server; never ship it to a
browser. This client has no `auth` and no `chat`; everything else on this page works with both.

```ts
// server/oaiz.ts
import { createClient } from "@oaiz/sdk";

export const oaiz = createClient({
  url: "https://api.oaiz.io",
  database: "<database id>",
  key: process.env.OAIZ_API_KEY ?? "",
});
```

## Query a database

```ts
// src/todos.ts
import { oaiz } from "./oaiz";

export async function addTodo(title: string) {
  return oaiz.from("todos").insert({ title, done: false }).select("id, title").single();
}

export async function finishTodo(id: string) {
  return oaiz.from("todos").update({ done: true }).eq("id", id);
}

export async function latestTodos() {
  return oaiz.from("todos").select("id, title, done").order("created_at", { ascending: false }).limit(20);
}
```

`upsert` and `delete` work the same way. A database view only reads.

`oaiz db types <database id> -o src/databases/<database id>.ts` writes a `Database` type for your
tables. Pass it as `createClient<Database>({ ... })` to check table names, columns and values as
you type.

`rpc` calls a function you created in the database with `create function`, with its arguments by
name. See [queries](https://oaiz.io/docs/databases/queries#rpc).

```ts
// src/functions.ts
import { oaiz } from "./oaiz";

export async function openCount() {
  const { data, error } = await oaiz.rpc("count_open_todos", { owner_id: "<member id>" });
  return error ? 0 : data;
}
```

Ask for `count` to get the number of matching rows:

```ts
// server/report.ts
import { oaiz } from "./oaiz.js";

export async function doneCount() {
  const { count, error } = await oaiz.from("todos").select("id", { count: "exact" }).eq("done", true);
  return error ? null : count;
}
```

## Use your integrations

Every integration you connect in OAIZ (Gmail, Slack, HubSpot, ...) is a set of tools. `tools.run`
runs one by `<integration id>:<action>`, with the action's arguments. Reads and writes are separate
switches: `executeIntegrationQuery` lets the call read from the provider and
`executeIntegrationCommand` lets it write. A switch that is off makes the call return the
provider's sample output instead, so a script cannot write by accident.

On the server, read the latest unread emails, have a model write a reply, and save it as a draft.
For a longer job, start a workflow instead (see [Run a workflow](#run-a-workflow)).

```ts
// server/inbox.ts
import { oaiz } from "./oaiz.js";

const gmail = "<gmail integration id>";

export async function unreadEmails() {
  const { data, error } = await oaiz.tools.run(`${gmail}:search_emails`, {
    arguments: { query: "is:unread newer_than:1d", limit: 5 },
    executeIntegrationQuery: true,
    executeIntegrationCommand: false,
  });
  if (error) throw new Error(error.message);
  return data.result?.emails;
}

export async function writeReply(email: unknown) {
  const { data, error } = await oaiz.llm.call({
    model: "openai/gpt-6-luna",
    system: "You answer customer email for Acme. Write only the reply, brief and concrete.",
    input: JSON.stringify(email),
  });
  if (error) throw new Error(error.message);
  return data.text;
}

export async function saveDraft(to: string, subject: string, body: string) {
  return oaiz.tools.run(`${gmail}:create_draft`, {
    arguments: { to: [to], subject, body },
    executeIntegrationQuery: true,
    executeIntegrationCommand: true,
  });
}
```

In the browser, give the agent the Gmail tools and let it read and draft itself. A tool with
`requireApproval` does not run until the member approves the call: the turn ends with a
`tool.approvalRequired` event, and `chat.approve` or `chat.decline`, with the same agent settings,
continues it. The app reaches only the integration actions shared with it (see [Setup](#setup)).

```ts
// src/inbox.ts
import { oaiz } from "./oaiz";

const gmail = "<gmail integration id>";
const agent = {
  systemPrompt: "You answer customer email for Acme. Be brief and concrete.",
  integrationTools: [
    { integrationUuid: gmail, actionType: "search_emails" },
    { integrationUuid: gmail, actionType: "create_draft", requireApproval: true },
  ],
};

// Returns the draft call that waits for the member, or null when the agent saved none.
export async function draftReplies() {
  let waiting: { sessionId: string; toolCallId: string } | null = null;
  for await (const { data: event, error } of oaiz.chat.send({ ...agent, content: "Draft replies to today's unread email." })) {
    if (error) throw new Error(error.message);
    if (event.type === "tool.approvalRequired") {
      waiting = { sessionId: event.sessionId ?? "", toolCallId: event.toolApprovalInfo?.toolCallId ?? "" };
    }
  }
  return waiting;
}

export async function decide(call: { sessionId: string; toolCallId: string }, approved: boolean) {
  const turn = approved ? oaiz.chat.approve({ ...agent, ...call }) : oaiz.chat.decline({ ...agent, ...call });
  for await (const { error } of turn) {
    if (error) throw new Error(error.message);
  }
}
```

Built-in OAIZ tools run the same way, by name. In the browser, a chat turn names them in
`nativeTools`, and `chat.tools()` lists the built-in tools and integration actions the app may use.

```ts
// server/places.ts
import { oaiz } from "./oaiz.js";

export async function coffeeNearby() {
  const { data, error } = await oaiz.tools.run("google_maps_search", {
    arguments: { query: "coffee near Stureplan, Stockholm", limit: 3 },
    executeIntegrationQuery: true,
    executeIntegrationCommand: false,
  });
  return error ? null : data.result;
}
```

## Run a workflow

`runs.start` starts a workflow's job from an event you describe; the event's `properties` are the
workflow's input. It yields the run's progress until the run ends or waits, for example for an
approval. The first frame is `root_start` with the run's ID in `actionExecutionLogUuid`. The last
is `terminal`, or `waiting` when the run waits, and its `terminalReason` says why: `success`,
`failure`, `awaiting-approval` and so on. In the browser, the app starts only the workflows shared
with it. A workflow is a set of jobs; `runs.start` takes the ID of one of its jobs
(`oaiz workflow job list <workflow id>`).

```ts
// server/runs.ts
import { oaiz } from "./oaiz.js";

export async function weeklyReport(week: number) {
  const run = oaiz.runs.start("<job id>", {
    event: { eventType: { provider: "reports", name: "report-requested" }, properties: { week } },
  });
  let reason = "";
  for await (const { data: progress, error } of run) {
    if (error) throw new Error(error.message);
    reason = progress.event.terminalReason ?? reason;
  }
  return reason;
}

// Reads a run again later, with its logs and results.
export async function readRun(runId: string) {
  const { data, error } = await oaiz.runs.get(runId);
  return error ? null : data.status;
}
```

Every frame carries an `after`. When the stream breaks, `runs.follow(<run id>, { after })` reads
on from the last frame you kept; following never starts the run again. `runs.list` lists runs, for
example the ones an event started, with `triggeringEventUuid`.

## Publish an event

An event's type is a `provider` and a `name`, each made of letters, digits and hyphens. Name the
provider after your app and the name after what happened, both lowercase with hyphens, for example
`orders/order-created`. Whoever publishes a type first claims it; a later publisher needs Edit on
it. `storage`, `schedule`, `oaiz-internal` and integration providers such as `gmail` are reserved.
Workflows that listen for the type start on it.

```ts
// server/events.ts
import { oaiz } from "./oaiz.js";

export async function orderCreated(orderId: string, total: number) {
  const { data, error } = await oaiz.events.publish({
    eventType: { provider: "orders", name: "order-created" },
    properties: { orderId, total },
  });
  if (error) throw new Error(error.message);
  return data.uuid;
}
```

## Call a model

`llm.call` asks a model for one answer to `input`, under an optional `system` instruction, and
returns the `text`, the `model` that answered and the `usage` in tokens. The call runs as the key's
or the signed-in member's organisation, within its budget, on a model the organisation permits in
both chat and workflows; a refusal is `error.code` `budget-exceeded` or `llm-model-not-permitted`.
An `input` longer than the model's context answers `llm-call-context-length`. The call waits up to
five minutes for the answer.

```ts
// server/summary.ts
import { oaiz } from "./oaiz.js";

export async function summarise(text: string) {
  const { data, error } = await oaiz.llm.call({
    model: "openai/gpt-6-luna",
    system: "Summarise the text in one sentence.",
    input: text,
  });
  if (error) throw new Error(error.message);
  return data.text;
}
```

## Create embeddings

`embeddings.create` turns each text into a vector, with `text-embedding-3-small` or
`text-embedding-3-large`; `dimensions` asks for shorter vectors. Vectors from different models, or
from one model at different dimensions, are not comparable, so store the model beside each vector.
`JSON.stringify(vector)` is the text a pgvector column takes.

```ts
// server/embeddings.ts
import { oaiz } from "./oaiz.js";

export async function saveArticle(title: string, text: string) {
  const { data, error } = await oaiz.embeddings.create({ model: "text-embedding-3-small", input: [text] });
  if (error) throw new Error(error.message);
  // data: { model, dimensions, embeddings, inputTokens }
  return oaiz.from("articles").insert({ title, model: data.model, embedding: JSON.stringify(data.embeddings[0]) });
}
```

## Chat with an agent

In the browser, as the signed-in member. `chat.send` streams the agent's answer as events.
`message.delta` events carry the text; `session.created` carries the ID of a new chat, which you
pass as `sessionId` to continue it.

```ts
// src/chat.ts
import { oaiz } from "./oaiz";

export async function ask(question: string, onText: (text: string) => void) {
  let answer = "";
  const turn = oaiz.chat.send({ content: question, systemPrompt: "You help the team plan their week." });
  for await (const { data: event, error } of turn) {
    if (error) throw new Error(error.message);
    if (event.type === "message.delta") {
      answer += event.delta?.content ?? "";
      onText(answer);
    }
  }
  return answer;
}
```

## Test mode: `@oaiz/sdk/test`

Test mode runs your app against local copies of your databases, with no network. You need an OAIZ
account once, to write each database's schema file. The `oaizTest` Vite plugin serves sign-in, rows
and database functions from [PGlite](https://pglite.dev) while the dev server runs as
`vite --mode oaiz-test`. It runs in Node only.

```sh
npm install --save-dev vite @electric-sql/pglite @electric-sql/pglite-pgvector
```

```ts
// vite.config.ts
import { oaizTest } from "@oaiz/sdk/test";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [oaizTest()] });
```

The plugin reads your app's `tests/` folder:

- `tests/databases/<database id>.sql`, the database's schema. Write it with
  `oaiz db test-schema <database id> -o tests/databases/<database id>.sql`; a hand-written
  `create table` file does not work, because the file also sets up the roles test mode signs in
  with.
- `tests/databases/<database id>.seed.sql` (optional), SQL that inserts the starting rows.
- `tests/members.json`, the people who can sign in:

  ```json
  {
    "teams": [{ "id": "7e570000-0000-4000-8000-000000000101", "name": "Sales" }],
    "members": [
      {
        "id": "7e570000-0000-4000-8000-000000000001",
        "name": "Ada Lovelace",
        "email": "ada@example.test",
        "teams": ["7e570000-0000-4000-8000-000000000101"],
        "role": "administrator"
      }
    ],
    "grants": { "<database id>": "view" }
  }
  ```

  Only `members` is required. Member and team IDs are UUIDs, as in OAIZ. A member's `role` is
  `member` (the default) or `administrator`, and its `teams` lists IDs from the top-level `teams`.
  `grants` sets the app's access per database; a database left out gets `edit`.

The plugin reads the folder on the first request, so after you change a file in `tests/`, restart
the dev server.

In test mode, set the client's `url` to `` `${window.location.origin}/__oaiz-test` ``. `signIn()`
then opens a local page where you pick a member. Chat, tools, model calls, embeddings, events
and workflow runs are not supported there and answer `501` with `error.code` `test-mode-unsupported`.
When a file in `tests/` does not load, the request answers `500` with `error.code`
`test-mode-setup` and the reason in `error.message`, and the dev server prints the reason.

## Setup

Each ID comes from the `oaiz` command-line tool or the OAIZ web app.

1. **An OAIZ account.** Install the CLI ([install](https://oaiz.io/docs/cli#install)) and sign in
   with `oaiz login` ([authentication](https://oaiz.io/docs/cli#authentication)).
2. **A database ID.** `oaiz db create --name todos` creates a database and prints its ID. See
   [databases](https://oaiz.io/docs/databases) for tables and migrations.
3. **An app ID**, for code that runs in the browser. `oaiz view create "Todos"` creates the app
   and prints its ID; the CLI calls an app a *view* and saves the ID as `viewId` in
   `.oaiz/view.json`. Give the app access to the database with
   `oaiz db access grant <database id> --subject-kind app --subject-id <app id> --capability edit`
   (or `view` for read only).
4. **An API key**, for code that runs on your server only. Create one in the OAIZ web app under
   Settings → API → API keys ([API keys](https://oaiz.io/docs/api-keys#create)).

**What the app reaches.** In the browser, the app reaches only what you share with it, and the
member only what they may use:

- integration actions:
  `oaiz integration access grant <integration id> --subject-kind app --subject-id <app id> --capability edit --tool-scope selected --action-types search_emails,create_draft`;
- workflows: `oaiz workflow access grant <workflow id> --subject-kind app --subject-id <app id> --capability view`;
- built-in tools: `oaiz app tools set <app id> --body '{"tools":["google_maps_search"]}'`.

**Where sign-in returns.** `signIn()` sends the browser to OAIZ, and OAIZ sends it back to the
same page, signed in. That page must be served from one of these addresses:

- the app's published address, or an HTTPS address you add with
  `oaiz app origins add <app id> --origin https://todos.example.com`; the member needs view
  access to the app;
- your local development server or a draft's preview while you develop; the member needs edit
  access to the app. On your local development server, OAIZ asks them to approve every sign-in.

## Errors never throw

Every call resolves to `{ data, error, count, status }`. On success `error` is `null`. On failure
`data` is `null` and `error` is `{ message, code, hints }`: `code` names the reason in a stable
form such as `auth-signed-out`, so compare `error.code` rather than `message`. `status` is the HTTP
status, or `0` when no answer arrived (offline, aborted). Auth calls resolve to `{ data, error }`
the same way. Streams (`chat.send`, `runs.start`) yield the same shape for each event. Only
`createClient` throws, when it gets both `key` and `app` or neither.

## Runtime support

Releases are tested on Node.js 26 and TypeScript 7.0. The package is ESM only.

**Tests**: every push to `main` and every pull request in the
[source repository](https://github.com/oaiz-io/oaiz-sdk) runs the unit and type tests, and
compiles every TypeScript example in this README, in
[CI](https://github.com/oaiz-io/oaiz-sdk/actions/workflows/ci.yaml). A release is published only
when the same tests pass.

- **Browsers**: current evergreen browsers, on a page served over HTTPS or from your own machine
  while you develop, which browsers treat as a secure context. The app client needs `fetch`,
  `crypto.randomUUID`, `crypto.getRandomValues`, `crypto.subtle`, `TextEncoder`, `btoa`,
  `sessionStorage` and streams. Voice chat (`chat.voice`) also needs `RTCPeerConnection`,
  `getUserMedia` and `AudioContext`.
- **Node.js** 22.12 or newer (`engines`).
- **Not tested**: Bun, Deno and edge runtimes. They may work, but no release checks them.

## Stability and changes

The package is versioned `0.x`: any release can change or remove part of the API, so pin the exact
version you test with (`npm install --save-exact @oaiz/sdk`). Each release is one commit and one
tag in the [source repository](https://github.com/oaiz-io/oaiz-sdk); compare two `sdk-v*` tags to
see what changed.

Report a bug at [github.com/oaiz-io/oaiz-sdk/issues](https://github.com/oaiz-io/oaiz-sdk/issues).
Report a vulnerability by email to security@oaiz.io, as
[SECURITY.md](https://github.com/oaiz-io/oaiz-sdk/blob/main/SECURITY.md) describes, not in a public
issue.

## Source and provenance

The source is in the `sdk/` folder of [oaiz-io/oaiz-sdk](https://github.com/oaiz-io/oaiz-sdk).
Each release is published from there by the repository's publish workflow, with npm provenance;
run `npm audit signatures` in a project that installs the package to verify its signatures.

## Licence

MIT
