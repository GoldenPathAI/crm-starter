import { count } from "drizzle-orm"
import type { PgTable } from "drizzle-orm/pg-core"

import { db } from "@/lib/db/client"
import {
  activities,
  clients,
  deals,
  documents,
  people,
  projects,
  rapportEntries,
  tickets,
} from "@/lib/db/schema/crm"
import { createServerLogger, logActionableError } from "@/lib/logger"

export interface TableCount {
  key: string
  label: string
  count: number
}

export interface CrmDbStatus {
  ok: boolean
  tables: TableCount[]
  totalRows: number
  errorMessage: string | null
}

export interface InternalApiStatus {
  configured: boolean
}

const logger = createServerLogger({ layer: "page", module: "NastaveniStatus" })

// drizzle wraps the driver error as "Failed query: <sql>", keeping the real reason
// (e.g. connection-limit) on `cause`. Prefer the cause so the panel shows why, not SQL.
function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause
    if (cause instanceof Error && cause.message.trim().length > 0) {
      return cause.message
    }
    return error.message
  }
  return "Neznámá chyba"
}

const CRM_TABLES: ReadonlyArray<{ key: string; label: string; table: PgTable }> = [
  { key: "clients", label: "Klienti", table: clients },
  { key: "people", label: "Kontakty", table: people },
  { key: "rapportEntries", label: "Raport", table: rapportEntries },
  { key: "deals", label: "Dealy", table: deals },
  { key: "projects", label: "Projekty", table: projects },
  { key: "tickets", label: "Úkoly", table: tickets },
  { key: "activities", label: "Aktivity", table: activities },
  { key: "documents", label: "Dokumenty", table: documents },
]

async function tableCount(table: PgTable): Promise<number> {
  const rows = await db.select({ value: count() }).from(table)
  return rows[0]?.value ?? 0
}

// Counting the crm tables doubles as a SELECT 1 connectivity probe: if the pool
// or the schema is unreachable the whole thing throws and the panel shows the error.
// The counts run sequentially on purpose: the pool is shared with the live app and
// its slots are scarce, so this page holds one connection at a time, never a burst.
export async function getCrmDbStatus(): Promise<CrmDbStatus> {
  try {
    const tables: TableCount[] = []
    for (const { key, label, table } of CRM_TABLES) {
      tables.push({ key, label, count: await tableCount(table) })
    }
    const totalRows = tables.reduce((sum, entry) => sum + entry.count, 0)
    return { ok: true, tables, totalRows, errorMessage: null }
  } catch (error) {
    const failure = error instanceof Error ? error : new Error("crm db status check failed")
    logActionableError(
      logger,
      failure,
      {
        problem: "Kontrola stavu databáze CRM selhala",
        why: "dotaz na počty řádků ve schématu crm vrátil chybu",
        fix: "ověř DATABASE_URL a dostupnost databáze",
        impact: "stav napojení na databázi se v Nastavení nezobrazí",
      },
      "CRM DB status check failed",
    )
    return { ok: false, tables: [], totalRows: 0, errorMessage: toErrorMessage(error) }
  }
}

export function getInternalApiStatus(): InternalApiStatus {
  const token = process.env.INTERNAL_API_TOKEN
  return { configured: token !== undefined && token.trim().length > 0 }
}
