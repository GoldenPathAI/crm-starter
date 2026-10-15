import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import postgres from "postgres"

const MIGRATIONS_DIR = join(process.cwd(), "drizzle")

async function main(): Promise<void> {
  // `--test` targets the local crm_test DB (TEST_DATABASE_URL) instead of DATABASE_URL,
  // so `pnpm test:db:migrate` can never touch the live DB even when .env arms both.
  const useTest = process.argv.includes("--test")
  const connectionString = useTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error(`${useTest ? "TEST_DATABASE_URL" : "DATABASE_URL"} environment variable is not set`)
  }

  if (useTest && !connectionString.includes("crm_test")) {
    throw new Error("TEST_DATABASE_URL neukazuje na crm_test, migrace přerušena.")
  }

  const sql = postgres(connectionString, {
    max: 10,
    connection: { idle_in_transaction_session_timeout: 60_000 },
  })

  try {
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
        console.log(`skip  ${file}`)
        continue
      }

      const contents = await readFile(join(MIGRATIONS_DIR, file), "utf8")
      await sql.begin(async (tx) => {
        await tx.unsafe(contents)
        await tx`INSERT INTO crm._migrations (filename) VALUES (${file})`
      })
      console.log(`apply ${file}`)
    }

    console.log("Migrace hotové")
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error("Migrace selhaly:", error)
  process.exit(1)
})
