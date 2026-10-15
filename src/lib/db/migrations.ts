import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import type { Sql } from "postgres"

export const MIGRATIONS_DIR = join(process.cwd(), "drizzle")

// Applies every not yet applied drizzle/*.sql file in filename order, each inside its own
// transaction, and records it in crm._migrations. Shared by `pnpm db:migrate` and the
// integration test setup, so both build the schema the same way.
export async function applyMigrations(
  sql: Sql,
  log: (line: string) => void,
): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS crm`
  await sql`
    CREATE TABLE IF NOT EXISTS crm._migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `

  const entries = await readdir(MIGRATIONS_DIR)
  const files = entries.filter((name) => name.endsWith(".sql")).sort((a, b) => a.localeCompare(b))
  const applied = await sql<{ filename: string }[]>`SELECT filename FROM crm._migrations`
  const appliedSet = new Set(applied.map((row) => row.filename))

  for (const file of files) {
    if (appliedSet.has(file)) {
      log(`skip  ${file}`)
      continue
    }

    const contents = await readFile(join(MIGRATIONS_DIR, file), "utf8")
    await sql.begin(async (tx) => {
      await tx.unsafe(contents)
      await tx`INSERT INTO crm._migrations (filename) VALUES (${file})`
    })
    log(`apply ${file}`)
  }
}
