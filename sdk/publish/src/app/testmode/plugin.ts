import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import type { Plugin, ViteDevServer } from "vite";

import { createTestServer, type OaizTestServer } from "./server";

export interface OaizTestOptions {
  /** The app's tests folder, relative to the Vite root: `databases/` and `members.json`. */
  directory?: string;
}

/** The mode `vite --mode oaiz-test` runs; Vitest's own mode is `test`, so Vitest never starts it. */
const testMode = "oaiz-test";
const prefix = "/__oaiz-test/";
const resetPath = `${prefix}test/reset`;

/**
 * Serves OAIZ sign-in, row requests and function calls under `/__oaiz-test/` from local test
 * databases, on the dev server of `vite --mode oaiz-test` only. The folder is read on the first
 * such request and again on every reset request.
 */
export function oaizTest({ directory = "tests" }: OaizTestOptions = {}): Plugin {
  return {
    name: "oaiz-test",
    apply: (_, env) => env.command === "serve" && env.mode === testMode,
    configureServer(server) {
      const folder = resolve(server.config.root, directory);
      let started: Promise<OaizTestServer> | undefined;

      server.httpServer?.once("close", () => {
        // A start that fails has already answered its request with the error.
        void started?.then((test) => test.close(), () => undefined);
      });

      server.middlewares.use((req, res, next) => {
        if (!(req.url ?? "").startsWith(prefix)) {
          next();
          return;
        }
        void (async () => {
          if (started === undefined) {
            started = createTestServer({ directory: folder });
            // A failed start is not kept, so the next request starts again from the files.
            started.catch(() => {
              started = undefined;
            });
          }
          const test = await started;
          const request = await fetchRequest(req, server);
          if (request.method === "POST" && new URL(request.url).pathname === resetPath) {
            await test.reset();
            res.statusCode = 204;
            res.end();
            return;
          }
          await writeResponse(res, await test.handle(request));
        })().catch((error: unknown) => {
          // A test file that does not run is for the developer to fix, so its error is the whole
          // answer, as the app client reads it, and is printed where the dev server runs.
          if (res.headersSent) return next(error);
          const message = error instanceof Error ? error.message : String(error);
          server.config.logger.error(`[oaiz-test] ${message}`, { timestamp: true });
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ message, slug: "test-mode-setup" }));
        });
      });
    },
  };
}

/** The Fetch request of a dev-server request, at the address the browser sent it to. */
async function fetchRequest(req: IncomingMessage, server: ViteDevServer): Promise<Request> {
  const protocol = server.config.server.https ? "https" : "http";
  const url = new URL(req.url ?? "/", `${protocol}://${req.headers.host}`);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  const method = req.method ?? "GET";
  const chunks: Buffer[] = [];
  if (method !== "GET" && method !== "HEAD") {
    for await (const chunk of req) chunks.push(chunk as Buffer);
  }
  return new Request(url, {
    method,
    headers,
    body: chunks.length === 0 ? undefined : Buffer.concat(chunks),
  });
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
