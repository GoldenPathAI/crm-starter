import postgres from "postgres"
import { applyMigrations } from "@/lib/db/migrations"
import { assertTestDatabaseUrl } from "@/test-support/testDatabase"

// Vitest global setup for the integration suite: brings the `_test` database up to the
// current schema before any suite runs, so `pnpm test:integration` needs no extra step.
export default async function migrateTestDatabase(): Promise<void> {
  // The migrations drop-and-recreate triggers idempotently; their NOTICEs are noise here.
  const sql = postgres(assertTestDatabaseUrl(process.env.DATABASE_URL), {
    max: 1,
    onnotice: () => undefined,
  })
  try {
    await applyMigrations(sql, () => undefined)
  } finally {
    await sql.end()
  }
}
