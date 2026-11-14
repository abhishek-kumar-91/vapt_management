import { resetDatabase } from "../scripts/db-reset.mjs"

/** Fresh schema once per `pnpm test` run. Tests use unique emails and slugs, so they never collide. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    console.warn(
      "TEST_DATABASE_URL is not set: database tests will fail. See .env.example."
    )
    return
  }
  await resetDatabase(url)
}
