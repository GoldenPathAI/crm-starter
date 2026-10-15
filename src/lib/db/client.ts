import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Sql } from "postgres"
import * as schema from "@/lib/db/schema/crm"

export type CrmDb = PostgresJsDatabase<typeof schema>
// The drizzle transaction handle, derived from the pool's transaction callback so
// the two stay in lockstep. A store function receives one of these through
// OrgScope.db when it must run inside a caller-owned (audited) transaction.
export type CrmTx = Parameters<Parameters<CrmDb["transaction"]>[0]>[0]
// Either the shared pool or an open transaction. Store functions resolve this via
// `scope.db ?? db` and never care which one they got.
export type CrmDbc = CrmDb | CrmTx

interface DbHandle {
  db: CrmDb
  sql: Sql
}

let handle: DbHandle | null = null

const createHandle = (): DbHandle => {
  const connectionString = process.env.DATABASE_URL
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  // The database host may be shared with other apps. Keep max small and force
  // Postgres to abort any transaction left idle so a stuck request can never pin a
  // connection and starve the live app.
  const sql = postgres(connectionString, {
    max: 10,
    connection: { idle_in_transaction_session_timeout: 60_000 },
  })

  return { db: drizzle(sql, { schema }), sql }
}

const getHandle = (): DbHandle => {
  if (handle === null) {
    handle = createHandle()
  }

  return handle
}

export const db: CrmDb = new Proxy({} as CrmDb, {
  get(_target, prop) {
    const active = getHandle().db

    return active[prop as keyof CrmDb]
  },
})

export const getSql = (): Sql => getHandle().sql
