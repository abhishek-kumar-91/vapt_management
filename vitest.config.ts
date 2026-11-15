import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

try {
  process.loadEnvFile(".env")
} catch {
  /* CI: variables come from the environment */
}

const root = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // Next's guard module throws outside a React Server build; tests run server code directly.
      "server-only": `${root}tests/empty.ts`,
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "docs/**", ".next/**"],
    globalSetup: ["tests/global-setup.ts"],
    // Tests only ever see the test database, never the app's DATABASE_URL.
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
    // One shared test database, reset once per run.
    fileParallelism: false,
  },
})
