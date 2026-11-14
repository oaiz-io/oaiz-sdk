import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// The generated client's operations and the app client's sources, read as text by the operation tests.

export const sdk = fileURLToPath(new URL("../..", import.meta.url));
const app = join(sdk, "app");

export type Operation = { id: string; method: string; path: string };

/** Every operation of the full generated client, keyed by its `Client` method name. */
export function generatedOperations(): Map<string, Operation> {
  const operations = new Map<string, Operation>();
  for (const file of readdirSync(join(sdk, "apis"))) {
    for (const declaration of readFileSync(join(sdk, "apis", file), "utf8").split(/^export const /m)) {
      const name = /^(\w+) = async function \(/.exec(declaration)?.[1];
      const method = /this\._request\(\s*"([A-Z]+)"/.exec(declaration)?.[1];
      const id = /operationId: "(\w+)"/.exec(declaration)?.[1];
      const path = /pathTemplate: "([^"]+)"/.exec(declaration)?.[1];
      if (name && method && id && path) operations.set(name, { id, method, path });
    }
  }
  return operations;
}

/** The app client's sources, by path relative to `app/`, without its tests. */
export function sources(directory = app): Map<string, string> {
  const found = new Map<string, string>();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "__tests__") for (const source of sources(path)) found.set(...source);
    if (entry.isFile() && entry.name.endsWith(".ts")) found.set(relative(app, path), readFileSync(path, "utf8"));
  }
  return found;
}
