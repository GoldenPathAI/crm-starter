import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.integration.test.ts"],
    environment: "node",
    // Migrates the `_test` database once, before any suite runs.
    globalSetup: ["src/test-support/migrateTestDatabase.ts"],
    // Refuses to run unless DATABASE_URL names a database ending in `_test`, and blocks
    // every outbound request, so a suite that forgets a mock fails loudly instead of
    // sending mail or writing to a bucket.
    setupFiles: ["src/test-support/setupIntegration.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
