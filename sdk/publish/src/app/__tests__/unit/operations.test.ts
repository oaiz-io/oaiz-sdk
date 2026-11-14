import { describe, expect, it } from "vitest";

import { rawOperations } from "../../raw-request";
import { generatedOperations, sources } from "../operations";

describe("published operations", () => {
  const operations = generatedOperations();
  const byId = new Map([...operations.values()].map((operation) => [operation.id, operation]));

  it("sends each raw request with the method and path of its operation", () => {
    for (const [id, { method, path }] of Object.entries(rawOperations)) {
      expect({ id, method, path }).toEqual(byId.get(id));
    }
  });

  it("sends requests only through raw-request.ts and, to the OAuth issuer, auth.ts", () => {
    const transports = /\b(?:fetch|XMLHttpRequest|EventSource|WebSocket|sendBeacon|importScripts)\b/g;
    const senders = [...sources()].filter(([, source]) => source.search(transports) >= 0).map(([path]) => path);
    expect(senders.sort()).toEqual(["auth.ts", "raw-request.ts"]);
    const auth = sources().get("auth.ts") ?? "";
    const issuerFetches = auth.match(/\bfetch\(\s*`\$\{this\.issuer\}\/[\w./-]*`/g) ?? [];
    expect(issuerFetches.length).toBe(auth.match(transports)?.length);
  });
});
