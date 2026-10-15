import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
    environment: "node",
    // Blocks every outbound request and strips the outbound credentials from the
    // process. Unit tests talk to mocks, never to Resend, S3 or a deployment.
    setupFiles: ["src/test-support/setupUnit.ts"],
  },
})
