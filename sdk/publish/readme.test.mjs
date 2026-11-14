// Type-checks every ```ts example of both READMEs against the built package, installed as a
// consumer installs it: `node_modules/@oaiz/sdk` holds the published manifest and the built dist/.
// Each package README example is written to the path its first line names (`// src/oaiz.ts`). Every
// example is checked with bundler resolution, and the Node files again with NodeNext, as a Vite app
// checks them. The `tests/members.json` example is parsed as JSON and holds only the keys test mode
// reads.
//
// The repository README sits beside the package folder in the published repository. An HTML
// comment before each of its examples names how it compiles: `example: browser` and
// `example: server` create a client; `example: with browser, server` runs after each named one, in
// a block of its own; `example: continues` runs after the example before it, in the same block.
//
//   node --test publish/readme.test.mjs   (after the build)
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const folder = fileURLToPath(new URL("..", import.meta.url));
const example = /^```ts\n\/\/ (?<path>[\w./-]+)\n(?<body>.*?)^```$/gms;
const members = /`tests\/members\.json`[^\n]*\n\n(?<indent> *)```json\n(?<body>.*?)^\k<indent>```$/ms;
const nodeFiles = ["vite.config.ts", "src/oaiz.ts", "server/oaiz.ts"];
const marked = /^<!-- example: (?<marker>[\w ,]+) -->\n```ts\n(?<body>.*?)^```$/gms;
const compilerOptions = { strict: true, noEmit: true, target: "ES2022", lib: ["ES2022", "DOM"], types: ["node"] };

function packageExamples(readme) {
  const files = new Map();
  for (const { groups } of readme.matchAll(example)) {
    assert.ok(!files.has(groups.path), `the README has two examples for ${groups.path}`);
    files.set(groups.path, `// ${groups.path}\n${groups.body}`);
  }
  assert.ok(files.size > 0, "the README has no ```ts example that names its file");
  const fences = readme.match(/^ *```ts$/gm) ?? [];
  assert.equal(fences.length, files.size, "every ```ts example of the README names its file on its first line");
  assert.deepEqual(nodeFiles.filter((name) => !files.has(name)), [], "the README has an example for every Node file");
  return files;
}

function repositoryExamples(readme) {
  const clients = new Map();
  const units = [];
  let count = 0;
  for (const { groups } of readme.matchAll(marked)) {
    count += 1;
    const marker = groups.marker.trim();
    if (marker === "browser" || marker === "server") {
      assert.ok(!clients.has(marker), `the repository README creates the ${marker} client twice`);
      clients.set(marker, groups.body);
      units.push({ names: [marker], body: "" });
    } else if (marker === "continues") {
      assert.ok(units.length > 0 && units.at(-1).body !== "", "the first example of the repository README continues none");
      units.at(-1).body += `\n${groups.body}`;
    } else {
      const names = marker.replace(/^with /, "").split(/, */);
      assert.ok(marker.startsWith("with ") && names.every((name) => clients.has(name)), `the repository README marks an example "${marker}"`);
      units.push({ names, body: groups.body });
    }
  }
  const fences = readme.match(/^ *```ts$/gm) ?? [];
  assert.ok(count > 0, "the repository README has no marked ```ts example");
  assert.equal(fences.length, count, "an HTML comment names how each ```ts example of the repository README compiles");
  const files = new Map();
  for (const [index, { names, body }] of units.entries()) {
    for (const name of names) files.set(`repository/${index}-${name}.ts`, `${clients.get(name)}\n{\n${body}\n}\n`);
  }
  return files;
}

function typeCheck(t, files, nodeChecked) {
  // Inside the package folder, so the examples resolve the build's TypeScript, Vite and @types/node.
  const project = mkdtempSync(join(folder, ".readme-"));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  const installed = join(project, "node_modules/@oaiz/sdk");
  mkdirSync(installed, { recursive: true });
  cpSync(join(folder, "publish.json"), join(installed, "package.json"));
  cpSync(join(folder, "publish/dist"), join(installed, "dist"), { recursive: true });
  for (const [path, body] of files) {
    mkdirSync(dirname(join(project, path)), { recursive: true });
    writeFileSync(join(project, path), body);
  }
  const configs = {
    "tsconfig.json": { compilerOptions: { ...compilerOptions, module: "ESNext", moduleResolution: "Bundler" }, files: [...files.keys()] },
    "tsconfig.node.json": { compilerOptions: { ...compilerOptions, module: "NodeNext", moduleResolution: "NodeNext" }, files: nodeChecked },
  };
  for (const [name, config] of Object.entries(configs)) {
    writeFileSync(join(project, name), JSON.stringify(config));
    const result = spawnSync(join(folder, "node_modules/.bin/tsc"), ["--project", name], { cwd: project, encoding: "utf8" });
    assert.equal(result.status, 0, `tsc --project ${name}:\n${result.stdout}${result.stderr}`);
  }
}

test("every README example compiles against the built package", (t) => {
  const files = packageExamples(readFileSync(join(folder, "README.md"), "utf8"));
  typeCheck(t, files, [...new Set([...nodeFiles, ...[...files.keys()].filter((path) => path.startsWith("server/"))])]);
});

test("every repository README example compiles against the built package", (t) => {
  const files = repositoryExamples(readFileSync(join(folder, "..", "README.md"), "utf8"));
  typeCheck(t, files, [...files.keys()].filter((path) => path.endsWith("-server.ts")));
});

test("the README's members file is JSON with the keys test mode reads", () => {
  const readme = readFileSync(join(folder, "README.md"), "utf8");
  const block = readme.match(members);
  assert.ok(block, "the README has no ```json example after `tests/members.json`");
  const parsed = JSON.parse(block.groups.body.replace(new RegExp(`^${block.groups.indent}`, "gm"), ""));
  assert.deepEqual(Object.keys(parsed).filter((key) => !["teams", "members", "grants"].includes(key)), []);
  assert.ok(Array.isArray(parsed.members) && parsed.members.length > 0, "the example names no member");
  for (const team of parsed.teams ?? []) assert.deepEqual(Object.keys(team).sort(), ["id", "name"]);
  for (const member of parsed.members) {
    assert.deepEqual(["id", "name", "email"].filter((key) => typeof member[key] !== "string"), []);
    assert.deepEqual(Object.keys(member).filter((key) => !["id", "name", "email", "teams", "role"].includes(key)), []);
  }
});
