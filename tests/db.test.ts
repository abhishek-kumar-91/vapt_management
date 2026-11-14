import { sql } from "drizzle-orm"
import { expect, test } from "vitest"

import { db } from "@/db"

test("test database is migrated and isn't the app database", async () => {
  const [row] = (
    await db.execute<{ db: string; tables: number }>(sql`
      select current_database() as db,
             (select count(*)::int from information_schema.tables where table_schema = 'public') as tables`)
  ).rows
  expect(row.tables).toBeGreaterThan(0)
  expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL)
})
