// Drop everything in a database and re-apply db/migrations from scratch.
//
//   DATABASE_URL=postgresql://localhost/vapt_dev pnpm db:reset
//
// Refuses any non-local database unless ALLOW_DB_RESET=1, so it can't wipe Neon by accident.
import { fileURLToPath } from "node:url"

import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"

const LOCAL_HOSTS = new Set(["", "localhost", "127.0.0.1", "[::1]"])
const MIGRATIONS = fileURLToPath(new URL("../db/migrations", import.meta.url))

export async function resetDatabase(url) {
  const { hostname, pathname } = new URL(url)
  if (!LOCAL_HOSTS.has(hostname) && process.env.ALLOW_DB_RESET !== "1")
    throw new Error(
      `Refusing to reset non-local database "${hostname}". Set ALLOW_DB_RESET=1 if you really mean it.`
    )
  const pool = new pg.Pool({ connectionString: url, max: 1 })
  try {
    await pool.query(
      "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;"
    )
    await migrate(drizzle({ client: pool }), { migrationsFolder: MIGRATIONS })
  } finally {
    await pool.end()
  }
  return pathname.slice(1)
}

if (import.meta.main) {
  try {
    process.loadEnvFile(".env")
  } catch {
    /* no .env: DATABASE_URL must come from the environment */
  }
  const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error("✗ MIGRATION_DATABASE_URL (or DATABASE_URL) is not set.")
    process.exit(1)
  }
  try {
    const name = await resetDatabase(url)
    console.log(`✓ ${name} reset and migrated`)
  } catch (error) {
    console.error(`✗ ${error.message}`)
    process.exit(1)
  }
}
