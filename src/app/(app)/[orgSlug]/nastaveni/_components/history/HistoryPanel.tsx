import { requireOrgContext } from "@/lib/auth/orgContext"
import { listRecentAudit, listUndoneBatches } from "@/lib/crm/audit/queries"
import { entityLabel } from "@/lib/crm/audit/humanize"
import { HistoryList } from "./HistoryList"
import type { EntityFilterOption } from "./HistoryFilter"
import { buildHistoryBatches } from "./historyView"

// Tables worth filtering by in the UI. Labels reuse the humanizer so they stay in
// sync with the entity names shown in each entry line.
const FILTER_TABLES: readonly string[] = [
  "clients",
  "deals",
  "projects",
  "tickets",
  "documents",
  "people",
  "activities",
  "enum_options",
  "organization_settings",
]

const FILTER_OPTIONS: readonly EntityFilterOption[] = FILTER_TABLES.map((table) => ({
  value: table,
  label: entityLabel(table),
}))

export async function HistoryPanel({
  orgSlug,
  entity,
}: {
  orgSlug: string
  entity?: string
}) {
  const ctx = await requireOrgContext(orgSlug)
  const canView = ctx.role === "admin" || ctx.role === "owner"
  if (!canView) {
    return (
      <p className="text-[13px] text-muted">
        Historii změn vidí jen správci pracovního prostoru.
      </p>
    )
  }

  const tableName = FILTER_TABLES.includes(entity ?? "") ? entity : undefined

  const entries = await listRecentAudit(ctx.scope.orgId, { limit: 50, tableName })
  const requestIds = entries
    .map((entry) => entry.requestId)
    .filter((id): id is string => id !== null)
  const undone = await listUndoneBatches(ctx.scope.orgId, requestIds)
  const batches = buildHistoryBatches(entries, undone)

  return (
    <HistoryList
      orgSlug={orgSlug}
      batches={batches}
      filterValue={tableName ?? ""}
      filterOptions={FILTER_OPTIONS}
    />
  )
}
