// Loads the built package and sends one row request to a local server, so a build whose bundle
// does not load or does not reach the API fails before it is packed.
//
//   node --test publish/smoke.test.mjs   (after the build)
import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import { test } from "node:test";

import { createClient } from "./dist/index.js";

test("a key client reads rows from the API", async (t) => {
  const requests = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      requests.push({ method: request.method, url: request.url, authorization: request.headers.authorization, body: JSON.parse(body) });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ rows: [{ id: 1, title: "Write the README" }], count: 1 }));
    });
  });
  await new Promise((listening) => server.listen(0, listening));
  t.after(() => server.close());
  const { address, family, port } = server.address();
  const host = family === "IPv6" ? `[${address}]` : address;

  const oaiz = createClient({ url: `http://${host}:${port}`, database: "todos", key: "server-key" });
  const answer = await oaiz.from("todos").select("id, title").eq("done", false);

  assert.deepEqual(answer, { data: [{ id: 1, title: "Write the README" }], error: null, count: 1, status: 200 });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[0].url, "/storage/databases/todos/rows/select");
  assert.equal(requests[0].authorization, "Bearer server-key");
  assert.equal(requests[0].body.table, "todos");
});
