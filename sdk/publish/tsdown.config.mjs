import { defineConfig } from "tsdown";

// The published `@oaiz/sdk`, built from the sources in src/. The root entry is one
// browser ES module of the app client that imports no package. `./test` is the Node-only test mode.
const shared = {
  format: "esm",
  outDir: "dist",
  clean: false,
  minify: false,
  report: false,
  dts: true,
  inputOptions: { checks: { pluginTimings: false } },
  outputOptions: { comments: { jsdoc: false } },
};

export default defineConfig([
  {
    ...shared,
    entry: { index: "src/app/index.ts" },
    platform: "browser",
    outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
    deps: { onlyImport: [] },
    tsconfig: "tsconfig.json",
  },
  {
    ...shared,
    entry: { test: "src/app/testmode/index.ts" },
    platform: "node",
    fixedExtension: true,
    deps: {
      // A string matches only the bare specifier, so the contrib subpaths need the pattern.
      neverBundle: [/^@electric-sql\/pglite(\/|$)/, "@electric-sql/pglite-pgvector", "vite"],
      onlyImport: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector", "vite"],
    },
    tsconfig: "tsconfig.testmode.json",
  },
]);
