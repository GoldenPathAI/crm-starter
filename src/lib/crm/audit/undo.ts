import { getTableColumns, sql } from "drizzle-orm"
import type { PgTable } from "drizzle-orm/pg-core"
import { newRequestId, runAudited } from "@/lib/crm/audit/context"
import { isBatchUndone, listAuditBatch, type AuditEntry } from "@/lib/crm/audit/queries"
import type { CrmDbc } from "@/lib/db/client"
import {
  activities,
  clients,
  dealAssignees,
  deals,
  documents,
  enumOptions,
  organizationSettings,
  people,
  projects,
  ticketAssignees,
  tickets,
} from "@/lib/db/schema/crm"

interface UndoTable {
  table: PgTable
  pk: string
}

// Whitelist of tables an undo may touch, each with its primary-key column. Any
// audit row for a table outside this map aborts the undo (never interpolate an
// untrusted table name into SQL).
const UNDO_TABLES: Record<string, UndoTable> = {
  clients: { table: clients, pk: "id" },
  people: { table: people, pk: "id" },
  deals: { table: deals, pk: "id" },
  projects: { table: projects, pk: "id" },
  tickets: { table: tickets, pk: "id" },
  ticket_assignees: { table: ticketAssignees, pk: "id" },
  deal_assignees: { table: dealAssignees, pk: "id" },
  activities: { table: activities, pk: "id" },
  documents: { table: documents, pk: "id" },
  enum_options: { table: enumOptions, pk: "id" },
  organization_settings: { table: organizationSettings, pk: "organization_id" },
}

// The net effect of a batch per row. A row touched several times in the batch is
// expected to match its last touch, so only the last entry per table and row counts.
export const lastTouchPerRow = (entries: readonly AuditEntry[]): AuditEntry[] => [
  ...new Map(entries.map((entry) => [`${entry.tableName}:${entry.rowId}`, entry])).values(),
]

const columnNames = (table: PgTable): string[] =>
  Object.values(getTableColumns(table)).map((column) => column.name)

// Current row still equals what the batch left it as (ignoring updated_at, which
// tracks unrelated writes). False when the row is gone or diverged.
async function currentMatchesAfter(
  tx: CrmDbc,
  def: UndoTable,
  rowId: string,
  after: Record<string, unknown>,
): Promise<boolean> {
  const rows = await tx.execute<{ ok: boolean | null }>(sql`
    SELECT (to_jsonb(t) - 'updated_at') = (${JSON.stringify(after)}::jsonb - 'updated_at') AS ok
    FROM ${def.table} AS t
    WHERE t.${sql.identifier(def.pk)} = ${rowId}
  `)
  const row = rows[0]

  return row?.ok === true
}

async function rowAbsent(tx: CrmDbc, def: UndoTable, rowId: string): Promise<boolean> {
  const rows = await tx.execute<{ present: number }>(sql`
    SELECT 1 AS present FROM ${def.table} AS t WHERE t.${sql.identifier(def.pk)} = ${rowId} LIMIT 1
  `)

  return rows.length === 0
}

async function applyInverse(tx: CrmDbc, entry: AuditEntry, def: UndoTable): Promise<void> {
  if (entry.operation === "INSERT") {
    await tx.execute(sql`DELETE FROM ${def.table} WHERE ${sql.identifier(def.pk)} = ${entry.rowId}`)

    return
  }

  if (entry.operation === "DELETE") {
    if (entry.before === null) {
      return
    }

    await tx.execute(sql`
      INSERT INTO ${def.table}
      SELECT * FROM jsonb_populate_record(NULL::${def.table}, ${JSON.stringify(entry.before)}::jsonb)
    `)

    return
  }

  // UPDATE inverse: a true UPDATE that rewrites every non-pk column from the before
  // snapshot, so it fires an UPDATE trigger (delete+reinsert would fire the wrong ones).
  if (entry.before === null) {
    return
  }

  const assignments = columnNames(def.table)
    .filter((name) => name !== def.pk)
    .map((name) => sql`${sql.identifier(name)} = p.${sql.identifier(name)}`)
  await tx.execute(sql`
    UPDATE ${def.table} AS t
    SET ${sql.join(assignments, sql`, `)}
    FROM jsonb_populate_record(NULL::${def.table}, ${JSON.stringify(entry.before)}::jsonb) AS p
    WHERE t.${sql.identifier(def.pk)} = ${entry.rowId}
  `)
}

// Deterministically revert a whole audited batch. Loads the batch, verifies the
// current DB still matches its net effect, then applies the inverse of every entry
// in reverse order inside one audited transaction (source undo, undo_of = the
// original request). Any divergence throws before a single write, so the surrounding
// transaction rolls back and nothing is applied. No LLM anywhere.
export async function undoBatch(
  orgId: string,
  requestId: string,
  meta: { actorUserId?: string },
): Promise<{ requestId: string; reverted: number }> {
  const entries = await listAuditBatch(orgId, requestId)
  if (entries.length === 0) {
    throw new Error("Dávku k vrácení se nepodařilo najít nebo je prázdná.")
  }

  if (await isBatchUndone(orgId, requestId)) {
    throw new Error("Tato dávka už byla vrácena.")
  }

  for (const entry of entries) {
    if (UNDO_TABLES[entry.tableName] === undefined) {
      throw new Error(`Tabulku ${entry.tableName} nelze vrátit.`)
    }
  }

  const undoRequestId = newRequestId()
  const reverted = await runAudited(
    {
      orgId,
      source: "undo",
      requestId: undoRequestId,
      actorType: meta.actorUserId !== undefined ? "user" : "system",
      actorUserId: meta.actorUserId,
      undoOf: requestId,
    },
    async (tx) => {
      // Verify pass, one row at a time on the transaction connection.
      const conflicts = await lastTouchPerRow(entries).reduce<Promise<string[]>>(
        async (previous, entry) => {
          const found = await previous
          const def = UNDO_TABLES[entry.tableName]
          if (def === undefined) {
            return found
          }

          const unchanged =
            entry.operation === "DELETE"
              ? await rowAbsent(tx, def, entry.rowId)
              : entry.after !== null && (await currentMatchesAfter(tx, def, entry.rowId, entry.after))

          return unchanged ? found : [...found, `${entry.tableName}#${entry.rowId}`]
        },
        Promise.resolve([]),
      )

      if (conflicts.length > 0) {
        throw new Error(
          `Nelze vrátit: záznamy se mezitím změnily (${conflicts.join(", ")}). Nic nebylo provedeno.`,
        )
      }

      // Apply pass, reverse order.
      let count = 0
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const entry = entries[i]
        if (entry === undefined) {
          continue
        }

        const def = UNDO_TABLES[entry.tableName]
        if (def === undefined) {
          continue
        }

        await applyInverse(tx, entry, def)
        count += 1
      }

      return count
    },
  )

  return { requestId: undoRequestId, reverted }
}
