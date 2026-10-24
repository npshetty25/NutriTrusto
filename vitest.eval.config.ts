import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * The recipe evaluation calls the REAL Gemini model, so it is kept out of the
 * normal test run (and CI): it costs quota and its answers vary. Run it by
 * hand with `npm run eval:recipes` after changing the recipe prompt or the
 * dish list, and compare the summary with the last run.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["eval/**/*.eval.ts"],
    testTimeout: 15 * 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
