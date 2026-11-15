import { defineConfig } from "drizzle-kit"

process.loadEnvFile?.(".env")

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  casing: "snake_case",
  // Migrations run as the table owner; the app itself connects as a member of app_user.
  dbCredentials: { url: (process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL)! },
  strict: true,
  verbose: true,
})
