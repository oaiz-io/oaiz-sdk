# OAIZ SDK

[![CI](https://github.com/oaiz-io/oaiz-sdk/actions/workflows/ci.yaml/badge.svg?branch=main)](https://github.com/oaiz-io/oaiz-sdk/actions/workflows/ci.yaml)

Build apps on [OAIZ](https://oaiz.io) with TypeScript. Query your OAIZ databases, run tools and
workflows, publish events, call a model, and chat with an agent, from the browser or from your
server.

```sh
npm install @oaiz/sdk
```

| Folder | Package |
| --- | --- |
| [`sdk/`](sdk/) | [`@oaiz/sdk`](https://www.npmjs.com/package/@oaiz/sdk), the TypeScript client. |
| [`app-kit/`](app-kit/) | [`@oaiz/app-kit`](https://www.npmjs.com/package/@oaiz/app-kit), components, hooks and a theme for apps built on OAIZ. You copy the source into your app. |

> **Not stable yet.** The packages are versioned `0.x`. A release can change the API, so pin the
> exact version: `npm install --save-exact @oaiz/sdk`.

**Tests**: every push to `main` and every pull request runs the SDK's unit and type tests, and
compiles every TypeScript example in the READMEs, in [CI](https://github.com/oaiz-io/oaiz-sdk/actions/workflows/ci.yaml).
Run them yourself with `pnpm test` in `sdk/`; [CONTRIBUTING.md](CONTRIBUTING.md) shows how.

## In the browser, in an OAIZ app

Give the client your app ID. It signs in a member of your organisation, and every request then runs
as that member, with their access.

<!-- example: browser -->
```ts
import { createClient } from "@oaiz/sdk";

const oaiz = createClient({
  url: "https://api.oaiz.io",
  app: "<app id>",
  database: "<database id>",
});

const { data: session } = await oaiz.auth.getSession();
if (session === null) await oaiz.auth.signIn(); // goes to OAIZ and comes back signed in

const { data: todos, error } = await oaiz.from("todos").select("id, title").eq("done", false);
```

## On the server, with an API key

Give the client an API key. Create one in OAIZ under Settings → API → API keys
([docs](https://oaiz.io/docs/api-keys#create)). Keep it on the server; never ship it to a browser.

<!-- example: server -->
```ts
import { createClient } from "@oaiz/sdk";

const oaiz = createClient({
  url: "https://api.oaiz.io",
  key: process.env.OAIZ_API_KEY ?? "",
  database: "<database id>",
});

const { data: todos, error } = await oaiz.from("todos").select("id, title").eq("done", false);
```

## What you can do

Every call resolves to `{ data, error }` and never throws. Only `createClient` throws, when it gets
both `key` and `app` or neither. The examples use the `oaiz` client from above; text in
`<angle brackets>` is yours to fill in.

### Query a database

<!-- example: with browser, server -->
```ts
// Read
const { data } = await oaiz
  .from("todos")
  .select("id, title, done")
  .eq("done", false)
  .order("created_at", { ascending: false })
  .limit(20);

// Write
await oaiz.from("todos").insert({ title: "Ship the SDK", done: false });
await oaiz.from("todos").update({ done: true }).eq("id", "<todo id>");
await oaiz.from("todos").delete().eq("id", "<todo id>");

// Call a database function
const { data: open } = await oaiz.rpc("count_open_todos", { owner_id: "<member id>" });
```

Run `oaiz db types <database id>` to generate a `Database` type, and pass it as
`createClient<Database>(...)` to get typed tables, columns and values.

### Use your integrations

Every integration you connect in OAIZ (Gmail, Slack, HubSpot, ...) is a set of tools. Run one with
`<integration id>:<action>`. Reads and writes are separate switches, so a script cannot write by
accident.

**On the server**, read the latest unread emails from Gmail, have a model write a reply, and save
it as a draft:

<!-- example: with server -->
```ts
const gmail = "<gmail integration id>";

const { data: inbox } = await oaiz.tools.run(`${gmail}:search_emails`, {
  arguments: { query: "is:unread newer_than:1d", limit: 5 },
  executeIntegrationQuery: true, // reads are on
  executeIntegrationCommand: false, // writes are off
});
```

<!-- example: continues -->
```ts
const { data: reply } = await oaiz.llm.call({
  model: "openai/gpt-6-luna",
  system: "You answer customer email for Acme. Write only the reply, brief and concrete.",
  input: JSON.stringify(inbox?.result?.emails),
});
```

<!-- example: continues -->
```ts
await oaiz.tools.run(`${gmail}:create_draft`, {
  arguments: { to: ["<customer email>"], subject: "Re: Your order", body: reply?.text ?? "" },
  executeIntegrationQuery: true,
  executeIntegrationCommand: true, // this call writes
});
```

For a longer job, start a [workflow](#run-a-workflow) instead.

**In the browser**, give the agent the Gmail tools and let it read and draft itself. Share the
integration with the app first. With `requireApproval`, the agent stops before it saves a draft,
until the member approves:

<!-- example: with browser -->
```ts
const gmail = "<gmail integration id>";
const agent = {
  systemPrompt: "You answer customer email for Acme. Be brief and concrete.",
  integrationTools: [
    { integrationUuid: gmail, actionType: "search_emails" },
    { integrationUuid: gmail, actionType: "create_draft", requireApproval: true },
  ],
};

let sessionId = "";
let toolCallId = "";
for await (const { data: event } of oaiz.chat.send({ ...agent, content: "Draft replies to today's unread email." })) {
  if (event?.type === "tool.approvalRequired") {
    sessionId = event.sessionId ?? "";
    toolCallId = event.toolApprovalInfo?.toolCallId ?? "";
  }
}

// Show the draft to the member. If they approve it:
for await (const { error } of oaiz.chat.approve({ ...agent, sessionId, toolCallId })) {
  if (error) throw new Error(error.message);
}
```

Built-in OAIZ tools run the same way, by name:

<!-- example: with server -->
```ts
const { data: places } = await oaiz.tools.run("google_maps_search", {
  arguments: { query: "coffee near Stureplan, Stockholm", limit: 3 },
  executeIntegrationQuery: true,
  executeIntegrationCommand: false,
});
```

### Run a workflow

Start a run with a workflow ID and an event. The event's `properties` are the workflow's input.

<!-- example: with browser, server -->
```ts
const run = oaiz.runs.start({
  workflow: "<workflow id>",
  event: { eventType: { provider: "custom", name: "report-requested" }, properties: { week: 46 } },
});
for await (const { data: progress, error } of run) {
  if (error) throw new Error(error.message);
  console.log(progress.event.type, progress.event.status);
}
const { data, error } = await run.result();
if (error) throw new Error(error.message);
console.log(data.status, data.events);
```

Skip the loop and call `result()` directly if you do not need progress.

### Publish an event

An app publishes as itself. On your server, a publish names a custom integration, or it is refused
([publish an event](sdk/README.md#publish-an-event)).

<!-- example: with browser -->
```ts
await oaiz.events.publish({
  eventType: { provider: "custom", name: "order-created" },
  properties: { orderId: "A-1042", total: 129 },
});
```

<!-- example: with server -->
```ts
await oaiz.events.publish({
  eventType: { provider: "custom", name: "order-created" },
  integrationUuid: "<integration id>",
  properties: { orderId: "A-1042", total: 129 },
});
```

### Call a model

One answer from a model, within your organisation's budget, on a model it permits in both chat and
workflows:

<!-- example: with browser, server -->
```ts
const { data, error } = await oaiz.llm.call({
  model: "openai/gpt-6-luna",
  system: "Summarise the text in one sentence.",
  input: "<text>",
});
// data: { text, model, usage: { inputTokens, outputTokens } }
```

### Create embeddings

<!-- example: with browser, server -->
```ts
const { data } = await oaiz.embeddings.create({
  model: "text-embedding-3-small",
  input: ["How do I reset my password?"],
});
```

### Chat with an agent

In the browser, as the signed-in member:

<!-- example: with browser -->
```ts
let answer = "";
const turn = oaiz.chat.send({ content: "What is on my plan today?", systemPrompt: "You help the team plan." });
for await (const { data: event } of turn) {
  if (event?.type === "message.delta") answer += event.delta?.content ?? "";
}
```

### Test locally

`@oaiz/sdk/test` is a Vite plugin that serves sign-in, rows and database functions from local copies
of your databases, with no network. See [test mode](sdk/README.md#test-mode-oaizsdktest).

## Learn more

- [`@oaiz/sdk` reference](sdk/README.md): setup, every feature, test mode, runtime support.
- [OAIZ documentation](https://oaiz.io/docs).
- [Contributing](CONTRIBUTING.md) and [how releases are made](CONTRIBUTING.md#how-releases-are-made).
- Report a vulnerability to security@oaiz.io; see [SECURITY.md](SECURITY.md).
- Each release is one commit and one tag; compare two `sdk-v*` tags to see what changed.

## Licence

[MIT](LICENSE).
