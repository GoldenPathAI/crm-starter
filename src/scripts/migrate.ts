import postgres from "postgres"
import { applyMigrations } from "@/lib/db/migrations"

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  const sql = postgres(connectionString, {
    max: 10,
    connection: { idle_in_transaction_session_timeout: 60_000 },
  })

  try {
    await applyMigrations(sql, (line) => console.log(line))
    console.log("Migrace hotové")
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error("Migrace selhaly:", error)
  process.exit(1)
})
