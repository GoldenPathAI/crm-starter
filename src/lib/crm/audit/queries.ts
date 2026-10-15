import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import type { CrmDbc } from "@/lib/db/client"
import { userNamesByIds } from "@/lib/crm/store/members"
import { auditLog } from "@/lib/db/schema/audit"

export type AuditEntry = typeof auditLog.$inferSelect

// An audit row hydrated with the display names behind its actor/on-behalf ids.
export interface AuditEntryWithActor extends AuditEntry {
  actorName: string | null
  onBehalfName: string | null
}

// Rows of tables without an organization_id column (ticket_assignees,
// deal_assignees) land in the log with a NULL org; they still belong to the batch
// keyed by the unguessable request id, so batch lookups accept them alongside the
// org's own rows.
const batchOrgFilter = (orgId: string) =>
  or(eq(auditLog.organizationId, orgId), isNull(auditLog.organizationId))

// One logical action/batch, oldest first. created_at is clock_timestamp() from the
// trigger, so it carries the true write order inside one transaction; id breaks
// the (practically impossible) same-microsecond tie.
export async function listAuditBatch(
  orgId: string,
  requestId: string,
  dbc: CrmDbc = db,
): Promise<AuditEntry[]> {
  return dbc
    .select()
    .from(auditLog)
    .where(and(batchOrgFilter(orgId), eq(auditLog.requestId, requestId)))
    .orderBy(asc(auditLog.createdAt), asc(auditLog.id))
}

// A batch is undone once any audit row points its undo_of back at that request.
export async function isBatchUndone(orgId: string, requestId: string, dbc: CrmDbc = db): Promise<boolean> {
  const rows = await dbc
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(batchOrgFilter(orgId), eq(auditLog.undoOf, requestId)))
    .limit(1)

  return rows.length > 0
}

// Most recent audit rows for an org, newest first, hydrated with actor names.
// Optional filters narrow to one entity table or one acting user.
export async function listRecentAudit(
  orgId: string,
  opts: { limit: number; tableName?: string; actorUserId?: string },
  dbc: CrmDbc = db,
): Promise<AuditEntryWithActor[]> {
  // and() drops the undefined entries, so an absent filter adds no condition.
  const where = and(
    eq(auditLog.organizationId, orgId),
    opts.tableName !== undefined ? eq(auditLog.tableName, opts.tableName) : undefined,
    opts.actorUserId !== undefined ? eq(auditLog.actorUserId, opts.actorUserId) : undefined,
  )

  const rows = await dbc
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(opts.limit)

  const ids = rows.flatMap((row) =>
    [row.actorUserId, row.onBehalfUserId].filter((id): id is string => id !== null),
  )
  const names = await userNamesByIds(ids)

  return rows.map((row) => ({
    ...row,
    actorName: row.actorUserId !== null ? names.get(row.actorUserId) ?? null : null,
    onBehalfName: row.onBehalfUserId !== null ? names.get(row.onBehalfUserId) ?? null : null,
  }))
}

// Identifies one entity in the audit log: its own table rows (matched by row_id) plus
// related rows whose before/after snapshot carries the entity id under fkColumn
// (e.g. deal_id on deal_assignees and tickets, ticket_id on ticket_assignees).
export interface AuditEntityTarget {
  tableName: string
  rowId: string
  fkColumn: string
}

// Audit rows touching one entity, newest first. Uses batchOrgFilter because assignee
// link tables land in the log with a NULL org; those rows are only reachable through
// the entity's unguessable id, which the caller has already resolved inside the org.
export async function listAuditForEntity(
  orgId: string,
  target: AuditEntityTarget,
  limit: number,
  dbc: CrmDbc = db,
): Promise<AuditEntry[]> {
  return dbc
    .select()
    .from(auditLog)
    .where(
      and(
        batchOrgFilter(orgId),
        or(
          and(eq(auditLog.tableName, target.tableName), eq(auditLog.rowId, target.rowId)),
          sql`${auditLog.after} ->> ${target.fkColumn} = ${target.rowId}`,
          sql`${auditLog.before} ->> ${target.fkColumn} = ${target.rowId}`,
        ),
      ),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
}

// Audit rows touching one client, newest first: the client row itself plus any row
// whose before/after snapshot carries this client_id (people, deals, documents, ...).
export async function listAuditForClient(
  orgId: string,
  clientId: string,
  limit: number,
  dbc: CrmDbc = db,
): Promise<AuditEntry[]> {
  return listAuditForEntity(orgId, { tableName: "clients", rowId: clientId, fkColumn: "client_id" }, limit, dbc)
}

// Which of the given batch request ids have already been undone. A single lookup so
// the history screen does not fire one isBatchUndone query per rendered batch.
export async function listUndoneBatches(
  orgId: string,
  requestIds: readonly string[],
  dbc: CrmDbc = db,
): Promise<Set<string>> {
  const unique = [...new Set(requestIds)]
  if (unique.length === 0) {
    return new Set()
  }

  const rows = await dbc
    .select({ undoOf: auditLog.undoOf })
    .from(auditLog)
    .where(and(batchOrgFilter(orgId), inArray(auditLog.undoOf, unique)))

  return new Set(rows.map((row) => row.undoOf).filter((id): id is string => id !== null))
}
