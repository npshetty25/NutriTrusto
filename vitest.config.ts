import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // Mirrors the "@/*" path alias in tsconfig.json so tests import the real
    // modules rather than copies. The bug this suite exists to catch was
    // hidden once by a test that reimplemented the logic it was checking.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
