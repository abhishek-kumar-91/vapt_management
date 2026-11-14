import "server-only"

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "./schema"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.")

// One pool per server instance; reused across dev hot reloads instead of leaking connections.
// Plain Postgres protocol: works with Neon (use its pooled "-pooler" host in production) and a local Postgres alike.
const globalForDb = globalThis as unknown as { pool?: Pool }
const pool = (globalForDb.pool ??= new Pool({ connectionString: url, max: 5 }))

/** Server-only Drizzle client. Supports interactive transactions. */
export const db = drizzle({ client: pool, schema, casing: "snake_case" })
export type Db = typeof db
