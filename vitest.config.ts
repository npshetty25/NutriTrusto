import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Pure logic and API-route handlers run in node. Component tests opt in to
    // jsdom per file with a `// @vitest-environment jsdom` docblock, so the
    // fast majority are not slowed down by a DOM they do not need.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "db/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // PGlite boots a WASM Postgres and applies three migrations per database.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "json-summary", "lcov"],
      // `all` counts files no test imports as 0%, which is the honest number.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.d.ts"],
      all: true,
    },
  },
  resolve: {
    // Mirrors the "@/*" path alias in tsconfig.json so tests import the real
    // modules rather than copies. The bug this suite exists to catch was
    // hidden once by a test that reimplemented the logic it was checking.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
