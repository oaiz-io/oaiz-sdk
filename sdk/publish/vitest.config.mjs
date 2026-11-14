import { defineConfig } from "vitest/config";

// The public repository's tests of the sources in src/: the app client's unit tests, and its type
// tests, which tsc checks with every other source under src/ through tsconfig.test.json.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    environment: "node",
    include: ["src/app/__tests__/unit/**/*.test.ts"],
    typecheck: {
      enabled: true,
      include: ["src/app/__tests__/types/**/*.test-d.ts"],
      tsconfig: "tsconfig.test.json",
    },
  },
});
